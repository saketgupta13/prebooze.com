const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// react-native-firebase's default iOS resolution is via Swift Package
// Manager, which this project's static-frameworks linkage (Expo's default)
// can't use — each firebase-dependent pod embeds its own copy of the
// firebase-ios-sdk SPM products (they're not `type: .dynamic`), so two or
// more react-native-firebase pods in the same static-linked target collide
// at link time with duplicate-symbol errors. Setting this flag before any
// target block makes CocoaPods resolve Firebase the old (pre-SPM) way
// instead, which has no such conflict under static linkage. Same fix
// react-native-firebase's own docs recommend for exactly this error.
function withFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('$RNFirebaseDisableSPM')) {
        contents = `$RNFirebaseDisableSPM = true\n${contents}`;
      }
      // With SPM disabled above, Firebase resolves via CocoaPods instead —
      // but FirebaseCoreInternal (a Swift pod) depends on GoogleUtilities,
      // which doesn't define modules, so static-library integration fails
      // without this. Same fix CocoaPods itself suggests in the error.
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(/^(platform :ios.*\n)/m, `$1use_modular_headers!\n`);
      }
      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withFirebaseDisableSPM;
