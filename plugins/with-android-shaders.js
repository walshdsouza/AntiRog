// Compiles GLSL shaders (e.g. the Vulkan Resizer.comp in
// react-native-vision-camera-resizer) to SPIR-V and packages them in the APK.
// 1. Turns on AGP's "shaders" build feature (off by default).
// 2. Points AGP at the NDK's glslc via android/local.properties (git-ignored,
//    machine-specific, regenerated on every prebuild).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { withGradleProperties, withDangerousMod } = require('expo/config-plugins');

const NDK_VERSION = '27.1.12297006'; // keep in sync with react-native's libs.versions.toml

function findGlslcDir() {
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(
      process.platform === 'win32'
        ? process.env.LOCALAPPDATA || ''
        : process.platform === 'darwin'
          ? path.join(os.homedir(), 'Library')
          : path.join(os.homedir(), '.local/share'),
      process.platform === 'win32' ? 'Android/Sdk' : 'Android/sdk'
    );
  const host =
    process.platform === 'win32' ? 'windows-x86_64' : process.platform === 'darwin' ? 'darwin-x86_64' : 'linux-x86_64';
  const dir = path.join(sdk, 'ndk', NDK_VERSION, 'shader-tools', host);
  return fs.existsSync(dir) ? dir : null;
}

module.exports = function withAndroidShaders(config) {
  config = withGradleProperties(config, (cfg) => {
    const key = 'android.defaults.buildfeatures.shaders';
    cfg.modResults = cfg.modResults.filter((i) => !(i.type === 'property' && i.key === key));
    cfg.modResults.push({ type: 'property', key, value: 'true' });
    return cfg;
  });

  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const dir = findGlslcDir();
      if (!dir) {
        console.warn(`[with-android-shaders] glslc not found for NDK ${NDK_VERSION}; install it or set ANDROID_HOME.`);
        return cfg;
      }
      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const kept = existing.split(/\r?\n/).filter((l) => l && !l.startsWith('glslc.dir='));
      const escaped = dir.replace(/\\/g, '/').replace(/:/g, '\\:');
      fs.writeFileSync(file, [...kept, `glslc.dir=${escaped}`].join('\n') + '\n');
      return cfg;
    },
  ]);
};
