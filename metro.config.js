const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// On-device models (react-native-fast-tflite) are bundled as assets via require('…/model.tflite').
config.resolver.assetExts.push('tflite');

module.exports = withNativeWind(config, { input: './global.css' });
