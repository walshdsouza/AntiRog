// Asks Google Play services to download the ML Kit text-recognition model when the app is
// installed, instead of on the first scan. expo-text-extractor uses the unbundled
// (play-services-mlkit-text-recognition) model on Android; without this, the first lab-report scan
// needs a network connection. Images are always processed on the device either way.
// https://developers.google.com/ml-kit/vision/text-recognition/v2/android#before-you-begin
//
// Library manifests declare the same meta-data with other models: expo-camera and (in debug builds)
// expo-dev-launcher both ask for `barcode_ui` (Google code scanner). Gradle's manifest merger can't
// combine values, so it fails with "Attribute meta-data#com.google.mlkit.vision.DEPENDENCIES@value
// … is also present at [:expo-dev-launcher]". The app manifest therefore lists every model the app
// needs and marks its value with tools:replace so it wins the merge.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const NAME = 'com.google.mlkit.vision.DEPENDENCIES';

// Models requested by libraries' own manifests, which this plugin can't read at prebuild time.
const LIBRARY_MODELS = ['barcode_ui'];

module.exports = function withMlkitOcrModel(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    manifest.manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const existing = AndroidConfig.Manifest.getMainApplicationMetaDataValue(manifest, NAME);
    // Keep any other ML Kit models another plugin asked for (comma-separated list).
    const models = new Set((existing || '').split(',').map((m) => m.trim()).filter(Boolean));
    LIBRARY_MODELS.forEach((m) => models.add(m));
    models.add('ocr');
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, NAME, [...models].join(','));

    const item = app['meta-data'].find((m) => m.$['android:name'] === NAME);
    item.$['tools:replace'] = 'android:value';
    return cfg;
  });
};
