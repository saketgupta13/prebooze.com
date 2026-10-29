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
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
}

module.exports = withFirebaseDisableSPM;
