/**
 * Config plugin to fix the RCTBridgeModule method signature mismatch in the
 * generated AppDelegate.swift.
 *
 * React Native 0.74 + Expo SDK 51 + Xcode 15 generates an AppDelegate that
 * overrides `extraModulesForBridge` with an optional return type
 * `[any RCTBridgeModule]?`, but the parent class (EXAppDelegateWrapper /
 * RCTBridgeDelegate) declares it as non-optional `[any RCTBridgeModule]`.
 * Xcode 15's stricter Swift type checker treats these as incompatible,
 * producing:
 *   - "cannot override instance method result type '[any RCTBridgeModule]'
 *     with optional type '[any RCTBridgeModule]?'"
 *   - "method does not override any method from its superclass"
 *
 * This plugin patches the generated AppDelegate.swift after prebuild so that
 * the return type matches the parent declaration.
 */

const { withAppDelegate } = require('@expo/config-plugins');

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
const withFixRCTBridgeModule = (config) => {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      // Objective-C AppDelegates don't have this problem.
      return config;
    }

    let contents = config.modResults.contents;

    // Pattern 1: `override func extraModulesForBridge(…) -> [any RCTBridgeModule]?`
    // Fix: drop the trailing `?` so the return type is non-optional.
    contents = contents.replace(
      /(override\s+func\s+extraModulesForBridge\s*\([^)]*\)\s*->\s*\[any RCTBridgeModule\])\?/g,
      '$1'
    );

    // Pattern 2: `func extraModulesForBridge(…) -> [any RCTBridgeModule]?`
    // (same fix without the `override` keyword)
    contents = contents.replace(
      /(func\s+extraModulesForBridge\s*\([^)]*\)\s*->\s*\[any RCTBridgeModule\])\?/g,
      '$1'
    );

    // Pattern 3: older `[RCTBridgeModule]?` spelling (no `any` keyword)
    contents = contents.replace(
      /((?:override\s+)?func\s+extraModulesForBridge\s*\([^)]*\)\s*->\s*\[RCTBridgeModule\])\?/g,
      '$1'
    );

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withFixRCTBridgeModule;
