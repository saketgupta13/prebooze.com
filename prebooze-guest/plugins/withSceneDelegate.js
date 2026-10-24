const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCENE_DELEGATE_CONTENT = `import UIKit
import React

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
}
`;

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
  config = withSceneDelegateTarget(config);
  return config;
};
