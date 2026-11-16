// Asks Google Play services to download the ML Kit text-recognition model when the app is
// installed, instead of on the first scan. expo-text-extractor uses the unbundled
// (play-services-mlkit-text-recognition) model on Android; without this, the first lab-report scan
// needs a network connection. Images are always processed on the device either way.
// https://developers.google.com/ml-kit/vision/text-recognition/v2/android#before-you-begin
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const NAME = 'com.google.mlkit.vision.DEPENDENCIES';

module.exports = function withMlkitOcrModel(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const existing = AndroidConfig.Manifest.getMainApplicationMetaDataValue(cfg.modResults, NAME);
    // Keep any other ML Kit models another plugin asked for (comma-separated list).
    const models = new Set((existing || '').split(',').map((m) => m.trim()).filter(Boolean));
    models.add('ocr');
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, NAME, [...models].join(','));
    return cfg;
  });
};
