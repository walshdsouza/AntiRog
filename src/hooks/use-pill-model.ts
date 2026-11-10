import { useMemo } from 'react';
import { useTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';
import { isResizerAvailable, useResizer, type Resizer } from 'react-native-vision-camera-resizer';

import { checkModel, PILL_MODEL, type PillModelConfig } from '@/lib/pill-model';

export type PillModelState =
  | { state: 'loading' }
  | { state: 'ready'; model: TensorflowModel; resizer: Resizer; config: PillModelConfig }
  | { state: 'unsupported'; message: string }
  | { state: 'error'; message: string };

// Checked once: whether this phone can run the GPU frame resizer (Metal on iOS; Vulkan on Android 9+).
let resizerAvailable: boolean | undefined;
function canResize() {
  try {
    resizerAvailable ??= isResizerAvailable();
  } catch {
    resizerAvailable = false;
  }
  return resizerAvailable;
}

/**
 * Loads the on-device pill model and the GPU resizer that turns camera frames into model input.
 * Both run on the phone's hardware; nothing is downloaded or uploaded. The model stays loaded only
 * while the calling screen is mounted.
 */
export function usePillModel(config: PillModelConfig = PILL_MODEL): PillModelState {
  // CPU (XNNPACK) is fast for a small quantized model and works on every device. GPU delegates need
  // the fast-tflite config plugin options and are worth trying once a real pill model exists.
  const tflite = useTensorflowModel(config.source, []);

  const resizer = useResizer({
    width: config.input.width,
    height: config.input.height,
    channelOrder: config.input.channelOrder,
    dataType: config.input.dataType,
    pixelLayout: config.input.pixelLayout,
    // Crop to fill rather than squash: keeps a pill's real shape.
    scaleMode: 'cover',
  });

  const problem = useMemo(
    () => (tflite.state === 'loaded' ? checkModel(tflite.model, config) : null),
    [tflite, config],
  );

  if (!canResize()) {
    return { state: 'unsupported', message: 'This phone does not support on-device pill scanning (it needs a GPU with Vulkan, Android 9 or newer).' };
  }
  if (tflite.state === 'error') return { state: 'error', message: `Could not load the pill model: ${tflite.error.message}` };
  if (resizer.state === 'error') return { state: 'error', message: `Could not start the image pipeline: ${resizer.error.message}` };
  if (problem) return { state: 'error', message: problem };
  if (tflite.state === 'loaded' && resizer.state === 'ready') {
    return { state: 'ready', model: tflite.model, resizer: resizer.resizer, config };
  }
  return { state: 'loading' };
}
