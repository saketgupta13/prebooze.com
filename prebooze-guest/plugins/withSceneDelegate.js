const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// RCTLinkingManager is referenced below with no Swift import — the
// React-RCTLinking pod has no DEFINES_MODULE/Swift module map (confirmed
// against its podspec), so `import React_RCTLinking` fails to compile
// ("no such module"). withBridgingHeader below injects the Objective-C
// import into the project's auto-generated bridging header instead,
// which is how Expo's own template already exposes ObjC-only pods to
// Swift files elsewhere in this project (see e.g. the organizer app's
// identically-patterned PreboozePartners-Bridging-Header.h).
const SCENE_DELEGATE_CONTENT = `import UIKit
import React

// Real bug found 2026-10-29: this file only ever implemented
// willConnectTo (written to fix an earlier black-screen crash — see its
// own startReactNative call). Once an app opts into UIScene-based
// lifecycle (UIApplicationSceneManifest in app.json), iOS routes BOTH
// Universal Links (NSUserActivity continuation) and custom-scheme
// redirects to the SceneDelegate instead of the AppDelegate — Expo's
// default (unmodified) template forwards both automatically, but this
// minimal replacement silently dropped them at the native layer before
// they ever reached RCTLinkingManager/JS. A tapped Universal Link still
// opened the app (iOS itself does that much regardless), but React
// Navigation's linking config never received the URL, so it always
// landed on the default route instead of the linked page.
//
// RCTLinkingManager (this RN version, 0.86.3) only exposes the older
// AppDelegate-style class methods — no scene-aware ones exist — so both
// handlers below call UIApplication.shared through those instead of a
// scene-specific API; RCTLinkingManager only needs the URL/userActivity
// itself, not which delegate it arrived through.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
    self.window = window
    appDelegate.window = window
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }
}
`;

// Confirmed against a real local build's generated Pods/Headers/Public
// tree — despite React-RCTLinking.podspec's header_dir = "RCTLinking",
// this RN version (0.86.3) actually publishes it under the main React
// umbrella's own header namespace instead (Pods/Headers/Public/
// React-Core/React/RCTLinkingManager.h), the same `React/` prefix
// SceneDelegate.swift already imports successfully.
const BRIDGING_HEADER_IMPORT = '#import <React/RCTLinkingManager.h>';

function withSceneDelegateFile(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName;
      const targetPath = path.join(projectRoot, 'ios', projectName, 'SceneDelegate.swift');
      fs.writeFileSync(targetPath, SCENE_DELEGATE_CONTENT);
      return config;
    },
  ]);
}

function withBridgingHeader(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName;
      const headerPath = path.join(projectRoot, 'ios', projectName, `${projectName}-Bridging-Header.h`);
      const existing = fs.existsSync(headerPath) ? fs.readFileSync(headerPath, 'utf8') : '';
      if (!existing.includes(BRIDGING_HEADER_IMPORT)) {
        fs.writeFileSync(headerPath, `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${BRIDGING_HEADER_IMPORT}\n`);
      }
      return config;
    },
  ]);
}

// Belt-and-suspenders alongside withBridgingHeader above — Expo's own
// Swift-support base plugin usually creates this file + build setting
// automatically once any .swift file exists in the project (confirmed:
// the organizer app has one, same naming pattern), but this makes sure
// SWIFT_OBJC_BRIDGING_HEADER is actually set on every build
// configuration regardless, so SceneDelegate.swift's RCTLinkingManager
// reference can't silently fail to compile if that auto-detection ever
// doesn't fire for some reason.
function withBridgingHeaderSetting(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const headerSetting = `"${projectName}/${projectName}-Bridging-Header.h"`;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const entry = configurations[key];
      if (entry && typeof entry === 'object' && entry.buildSettings && entry.buildSettings.PRODUCT_NAME) {
        entry.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = headerSetting;
      }
    }
    return config;
  });
}

function withSceneDelegateTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;
    const groupPath = projectName;
    const relativePath = `${projectName}/SceneDelegate.swift`;

    const group = project.pbxGroupByName(groupPath);
    const alreadyAdded =
      group &&
      group.children.some((c) => {
        const ref = project.hash.project.objects.PBXFileReference[c.value];
        return ref && ref.path && ref.path.replace(/"/g, '').endsWith('SceneDelegate.swift');
      });

    if (!alreadyAdded) {
      const groupKey = project.findPBXGroupKey({ name: groupPath });
      project.addSourceFile(
        relativePath,
        { target: project.getFirstTarget().uuid },
        groupKey
      );
    }

    return config;
  });
}

module.exports = function withSceneDelegate(config) {
  config = withSceneDelegateFile(config);
  config = withBridgingHeader(config);
  config = withBridgingHeaderSetting(config);
  config = withSceneDelegateTarget(config);
  return config;
};
