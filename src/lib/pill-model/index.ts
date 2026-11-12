import type { Tensor, TensorflowModel } from 'react-native-fast-tflite';

import { matchDrug } from '@/lib/interactions';

import { STANDIN_DRUG_FOR_LABEL } from './standin-drug-map';
import { STANDIN_LABELS } from './standin-labels';

/*
 * On-device pill identifier (Phase 5). Everything about the model lives in this one config, so a
 * trained pill classifier replaces the stand-in by changing `source`, `labels` and the tensor
 * details below; the camera pipeline adapts to it.
 *
 * Runs entirely on the phone with react-native-fast-tflite: no image ever leaves the device.
 */

export type PillModelConfig = {
  /** Shown in the UI and logs. */
  name: string;
  /** require(...) of a bundled .tflite (metro.config.js lists tflite as an asset extension). */
  source: number;
  /**
   * True while the bundled model is the generic ImageNet stand-in, which recognises everyday
   * objects, not pills. The scanner says so on screen.
   */
  isStandIn: boolean;
  input: {
    width: number;
    height: number;
    /** 'uint8' = 0…255 per channel. 'float32' = 0.0…1.0 per channel (the resizer's float range). */
    dataType: 'uint8' | 'float32';
    channelOrder: 'rgb' | 'bgr';
    /** 'interleaved' = NHWC (most TFLite models), 'planar' = NCHW. */
    pixelLayout: 'interleaved' | 'planar';
  };
  output: {
    dataType: 'uint8' | 'float32';
    /** Dequantization for uint8 outputs: value = scale × (q − zeroPoint). Netron shows both. */
    scale: number;
    zeroPoint: number;
    /** 'softmax' if the model outputs logits, 'none' if it already outputs probabilities. */
    activation: 'none' | 'softmax';
  };
  /** One per output class, in output order. */
  labels: readonly string[];
  /** Results below this probability are not shown as a match. */
  minConfidence: number;
  /**
   * The scanner locks onto a result, pauses the camera and checks it against the vault once the same
   * class scores at least `lockConfidence` on `lockFrames` inferences in a row. Requiring a streak
   * stops a single lucky frame from triggering a check.
   */
  lockConfidence: number;
  lockFrames: number;
  /**
   * Optional label → standard drug name overrides. Labels not listed here are matched as medication
   * text (brand or generic names), which is what a trained pill model's labels will be.
   */
  drugForLabel?: Readonly<Record<string, string>>;
};

/**
 * Stand-in: MobileNet v1 1.0 224 (quantized), from TensorFlow's hosted models (Apache-2.0).
 * Input uint8 [1,224,224,3] RGB; output uint8 [1,1001] probabilities, scale 1/256, zero point 0.
 */
export const PILL_MODEL: PillModelConfig = {
  name: 'MobileNet v1 (stand-in)',
  // Metro bundles assets through require(); there is no import syntax for a .tflite file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  source: require('../../../assets/models/standin-mobilenet-v1-224-quant.tflite'),
  isStandIn: true,
  input: { width: 224, height: 224, dataType: 'uint8', channelOrder: 'rgb', pixelLayout: 'interleaved' },
  output: { dataType: 'uint8', scale: 0.00390625, zeroPoint: 0, activation: 'none' },
  labels: STANDIN_LABELS,
  minConfidence: 0.2,
  lockConfidence: 0.75,
  lockFrames: 3,
  // Placeholder so everyday objects stand in for drugs while testing; see standin-drug-map.ts.
  drugForLabel: STANDIN_DRUG_FOR_LABEL,
};

/** The standard drug name a model label stands for, or '' if AntiRog doesn't recognise it. */
export function drugForLabel(config: PillModelConfig, label: string): string {
  return config.drugForLabel?.[label] ?? matchDrug(label).standardName;
}

/**
 * For each class, the first class index that stands for the same drug; classes with no drug map to
 * themselves. The scanner adds up the scores of classes in one group, so a drug split across
 * look-alike classes (e.g. "coffee mug" and "cup", or two pills that look the same) still locks.
 */
export function drugGroups(config: PillModelConfig): number[] {
  const firstByDrug = new Map<string, number>();
  return config.labels.map((label, index) => {
    const drug = drugForLabel(config, label);
    if (!drug) return index;
    if (!firstByDrug.has(drug)) firstByDrug.set(drug, index);
    return firstByDrug.get(drug)!;
  });
}

/** Bytes one input image takes: width × height × 3 channels × bytes per channel. */
export function inputByteLength(config: PillModelConfig) {
  const bytesPerValue = config.input.dataType === 'uint8' ? 1 : 4;
  return config.input.width * config.input.height * 3 * bytesPerValue;
}

function shapeText(tensor: Tensor) {
  return `${tensor.dataType}[${tensor.shape.join(',')}]`;
}

/**
 * Checks that the loaded model matches PILL_MODEL, so a swapped-in model with a different input size
 * or label count fails loudly at load time instead of producing garbage predictions.
 * Returns a developer-facing problem description, or null if it matches.
 */
export function checkModel(model: TensorflowModel, config: PillModelConfig): string | null {
  const [input] = model.inputs;
  const [output] = model.outputs;
  if (!input || !output) return 'The model needs at least one input and one output tensor.';

  const { width, height, dataType, pixelLayout } = config.input;
  const expected = pixelLayout === 'interleaved' ? [1, height, width, 3] : [1, 3, height, width];
  if (input.dataType !== dataType || input.shape.join(',') !== expected.join(',')) {
    return `Model input is ${shapeText(input)}, but PILL_MODEL expects ${dataType}[${expected.join(',')}].`;
  }

  const classes = output.shape[output.shape.length - 1];
  if (output.dataType !== config.output.dataType || classes !== config.labels.length) {
    return (
      `Model output is ${shapeText(output)}, but PILL_MODEL expects ${config.output.dataType} with ` +
      `${config.labels.length} classes (one per label).`
    );
  }
  return null;
}

export type TopK = { indices: number[]; scores: number[] };

/**
 * Picks the `k` most likely classes from the model's raw output and returns their probabilities.
 * Runs on the camera's frame thread, so it only uses plain JS and the values passed in.
 */
export function decodeTopK(
  output: ArrayBuffer,
  k: number,
  dataType: 'uint8' | 'float32',
  scale: number,
  zeroPoint: number,
  softmax: boolean,
): TopK {
  'worklet';
  const raw = dataType === 'uint8' ? new Uint8Array(output) : new Float32Array(output);
  const values = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    values[i] = dataType === 'uint8' ? scale * (raw[i] - zeroPoint) : raw[i];
  }

  if (softmax) {
    let max = -Infinity;
    for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      values[i] = Math.exp(values[i] - max);
      sum += values[i];
    }
    for (let i = 0; i < values.length; i++) values[i] /= sum;
  }

  const indices: number[] = [];
  const scores: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (indices.length === k && v <= scores[k - 1]) continue;
    // Insert in descending order.
    let at = Math.min(indices.length, k - 1);
    while (at > 0 && scores[at - 1] < v) at--;
    indices.splice(at, 0, i);
    scores.splice(at, 0, v);
    if (indices.length > k) {
      indices.pop();
      scores.pop();
    }
  }
  return { indices, scores };
}

/**
 * Returns `pixels` as a tightly packed buffer of `expected` bytes. GPU buffers may pad each row;
 * if so, the padding is dropped row by row. Runs on the frame thread.
 */
export function packPixels(pixels: ArrayBuffer, expected: number, rows: number): ArrayBuffer | null {
  'worklet';
  if (pixels.byteLength === expected) return pixels;
  const rowBytes = expected / rows;
  const stride = pixels.byteLength / rows;
  if (!Number.isInteger(stride) || stride < rowBytes) return null;
  const source = new Uint8Array(pixels);
  const packed = new Uint8Array(expected);
  for (let row = 0; row < rows; row++) {
    packed.set(source.subarray(row * stride, row * stride + rowBytes), row * rowBytes);
  }
  return packed.buffer;
}
