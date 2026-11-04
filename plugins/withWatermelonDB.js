const {
  withSettingsGradle,
  withAppBuildGradle,
  withMainApplication,
} = require('expo/config-plugins');

const JSI_PROJECT = ':watermelondb-jsi';
const JSI_PATH = '../node_modules/@nozbe/watermelondb/native/android-jsi';
const JSI_IMPORT = 'import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage';
const JSI_ADD = 'add(WatermelonDBJSIPackage())';

/** Registers the WatermelonDB JSI gradle module in settings.gradle. */
function addSettingsGradle(config) {
  return withSettingsGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(JSI_PROJECT)) {
      cfg.modResults.contents +=
        `\ninclude '${JSI_PROJECT}'\n` +
        `project('${JSI_PROJECT}').projectDir = ` +
        `new File(rootProject.projectDir, '${JSI_PATH}')\n`;
    }
    return cfg;
  });
}

/** Adds the JSI module dependency and a libc++_shared pickFirst rule. */
function addAppBuildGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes(`project('${JSI_PROJECT}')`)) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation project('${JSI_PROJECT}')\n`
      );
    }

    if (!contents.includes("pickFirsts += '**/libc++_shared.so'")) {
      contents = contents.replace(
        /packagingOptions\s*\{/,
        "packagingOptions {\n        pickFirsts += '**/libc++_shared.so'"
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

/** Imports and registers WatermelonDBJSIPackage in MainApplication.kt. */
function addMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes(JSI_IMPORT)) {
      contents = contents.replace(
        /(import com\.facebook\.react\.PackageList)/,
        `$1\n${JSI_IMPORT}`
      );
    }

    if (!contents.includes(JSI_ADD)) {
      const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!anchor.test(contents)) {
        throw new Error(
          'withWatermelonDB: could not find PackageList(this).packages.apply { in MainApplication.kt'
        );
      }
      contents = contents.replace(anchor, (m) => `${m}\n          ${JSI_ADD}`);
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withWatermelonDB(config) {
  config = addSettingsGradle(config);
  config = addAppBuildGradle(config);
  config = addMainApplication(config);
  return config;
};
