// Native Android builds on Windows: AGP's default CMake (3.22.1) bundles Ninja 1.10, which has no
// long-path support, and the app's codegen objects (react-native-gesture-handler's shadow nodes)
// land past MAX_PATH: "ninja: error: Stat(...): Filename longer than 260 characters". The Ninja
// of CMake 3.31 handles long paths (Windows must have LongPathsEnabled = 1). Expo's root project
// plugin applies `android.cmakeVersion` to every module. AGP only downloads its default CMake, so
// install this one once: `sdkmanager "cmake;3.31.6"`. Only prebuilds run on Windows get it: EAS
// and other Linux/macOS builds keep AGP's default.
const { withGradleProperties } = require('expo/config-plugins');

const WINDOWS_CMAKE_VERSION = '3.31.6';
const KEY = 'android.cmakeVersion';

module.exports = function withWindowsCmake(config) {
  if (process.platform !== 'win32') return config;
  return withGradleProperties(config, (gradle) => {
    gradle.modResults = gradle.modResults.filter(
      (item) => item.type !== 'property' || item.key !== KEY,
    );
    gradle.modResults.push({ type: 'property', key: KEY, value: WINDOWS_CMAKE_VERSION });
    return gradle;
  });
};
