/**
 * Patches expo-dev-menu@4.5.8 and expo-dev-launcher@3.6.10 to fix iOS build
 * errors with RN 0.74 + Xcode 15.
 *
 * Runs as a postinstall hook — works regardless of pnpm version (v9 or v10).
 * Files are unlinked before writing to break pnpm hardlinks to the global store.
 *
 * ── expo-dev-menu ──────────────────────────────────────────────────────────
 * Swift (Xcode 15 strict override checking):
 *   1. DevMenuAppInstance.swift
 *      `-> [RCTBridgeModule]!` → `-> [RCTBridgeModule]`
 *      (base class return type is non-optional)
 *
 *   2. ExpoDevMenuReactDelegateHandler.swift
 *      `public override func createRootView` → `public func createRootView`
 *      (method no longer exists on superclass)
 *
 * Objective-C (RN 0.74 removed JSCExecutorFactory.h):
 *   3. DevMenuRCTBridge.mm
 *   4. ReactNativeCompatibles/ReactNative/DevClientAppDelegate.mm
 *   5. ReactNativeCompatibles/ReactNative72/DevClientAppDelegate.mm
 *      Prepend `#ifndef USE_HERMES / #define USE_HERMES 1 / #endif` before
 *      RCTAppSetupUtils.h so JSCExecutorFactory.h is never included.
 *
 * ── expo-dev-launcher ──────────────────────────────────────────────────────
 * Swift (Xcode 15 strict override checking + optional type mismatches):
 *   6. ExpoDevLauncherReactDelegateHandler.swift
 *      a. `public override func createBridge`  → `public func createBridge`
 *      b. `public override func createRootView` → `public func createRootView`
 *      c. `let bridge = bridgeDelegateHandler.createBridge...`
 *         → `guard let bridge = ...` (bridge is RCTBridge?, unwrap before use)
 *      d. `initProps: self.rootViewInitialProperties`
 *         → `initProps: self.rootViewInitialProperties ?? [:]`
 *         ([AnyHashable:Any]? → non-optional required by createRootView)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Shared constants ────────────────────────────────────────────────────────

// The RCTAppSetupUtils.h import block that appears in three expo-dev-menu .mm files
const RCT_APP_SETUP_IMPORT = `#if __has_include(<React_RCTAppDelegate/RCTAppSetupUtils.h>)
// for importing the header from framework, the dash will be transformed to underscore
#import <React_RCTAppDelegate/RCTAppSetupUtils.h>
#else
#import <React-RCTAppDelegate/RCTAppSetupUtils.h>
#endif`;

const RCT_APP_SETUP_IMPORT_FIXED = `// RN 0.74 removed JSCExecutorFactory.h; guard against its inclusion when
// the USE_HERMES build setting isn't propagated to this translation unit.
#ifndef USE_HERMES
#define USE_HERMES 1
#endif
${RCT_APP_SETUP_IMPORT}`;

// The bridge-creation block in ExpoDevLauncherReactDelegateHandler.swift that
// uses `let` (yields optional) then passes the optional directly to methods
// that now require non-optionals.
const DEV_LAUNCHER_BRIDGE_BLOCK = `    let bridge = bridgeDelegateHandler.createBridgeAndSetAdapter(launchOptions: developmentClientController.getLaunchOptions())
    developmentClientController.appBridge = bridge

    guard let rootView = bridgeDelegateHandler.createRootView(
      with: bridge,
      // swiftlint:disable:next force_unwrapping
      moduleName: self.rootViewModuleName!,
      initProps: self.rootViewInitialProperties
    ) else {
      return
    }`;

const DEV_LAUNCHER_BRIDGE_BLOCK_FIXED = `    guard let bridge = bridgeDelegateHandler.createBridgeAndSetAdapter(launchOptions: developmentClientController.getLaunchOptions()) else {
      return
    }
    developmentClientController.appBridge = bridge

    guard let rootView = bridgeDelegateHandler.createRootView(
      with: bridge,
      // swiftlint:disable:next force_unwrapping
      moduleName: self.rootViewModuleName!,
      initProps: self.rootViewInitialProperties ?? [:]
    ) else {
      return
    }`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function findPackageRoot(pkgPrefix) {
  const virtualStore = path.join(process.cwd(), 'node_modules', '.pnpm');
  if (!fs.existsSync(virtualStore)) {
    const flat = path.join(process.cwd(), 'node_modules', pkgPrefix.split('@')[0]);
    return fs.existsSync(flat) ? flat : null;
  }
  const entries = fs.readdirSync(virtualStore);
  for (const entry of entries) {
    if (entry.startsWith(pkgPrefix)) {
      const pkgName = pkgPrefix.split('@')[0];
      const candidate = path.join(virtualStore, entry, 'node_modules', pkgName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-native-deps] not found, skipping: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  if (!changed) {
    console.log(`[patch-native-deps] already patched: ${path.relative(process.cwd(), filePath)}`);
    return;
  }

  // Unlink before writing to break the pnpm hardlink to the global store.
  fs.unlinkSync(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-native-deps] patched: ${path.relative(process.cwd(), filePath)}`);
}

// ── expo-dev-menu patches ───────────────────────────────────────────────────

const devMenuRoot = findPackageRoot('expo-dev-menu@4.5.8');
if (!devMenuRoot) {
  console.log('[patch-native-deps] expo-dev-menu not found, skipping');
} else {
  patchFile(
    path.join(devMenuRoot, 'ios', 'DevMenuAppInstance.swift'),
    [['-> [RCTBridgeModule]!', '-> [RCTBridgeModule]']]
  );

  patchFile(
    path.join(devMenuRoot, 'ios', 'ReactDelegateHandler', 'ExpoDevMenuReactDelegateHandler.swift'),
    [['public override func createRootView(reactDelegate:', 'public func createRootView(reactDelegate:']]
  );

  patchFile(
    path.join(devMenuRoot, 'ios', 'DevMenuRCTBridge.mm'),
    [[RCT_APP_SETUP_IMPORT, RCT_APP_SETUP_IMPORT_FIXED]]
  );

  patchFile(
    path.join(devMenuRoot, 'ios', 'ReactNativeCompatibles', 'ReactNative', 'DevClientAppDelegate.mm'),
    [[RCT_APP_SETUP_IMPORT, RCT_APP_SETUP_IMPORT_FIXED]]
  );

  patchFile(
    path.join(devMenuRoot, 'ios', 'ReactNativeCompatibles', 'ReactNative72', 'DevClientAppDelegate.mm'),
    [[RCT_APP_SETUP_IMPORT, RCT_APP_SETUP_IMPORT_FIXED]]
  );
}

// ── expo-dev-launcher patches ───────────────────────────────────────────────

const devLauncherRoot = findPackageRoot('expo-dev-launcher@3.6.10');
if (!devLauncherRoot) {
  console.log('[patch-native-deps] expo-dev-launcher not found, skipping');
} else {
  patchFile(
    path.join(devLauncherRoot, 'ios', 'ReactDelegateHandler', 'ExpoDevLauncherReactDelegateHandler.swift'),
    [
      // (a) createBridge: remove spurious override
      [
        'public override func createBridge(reactDelegate: ExpoReactDelegate, bridgeDelegate: RCTBridgeDelegate,',
        'public func createBridge(reactDelegate: ExpoReactDelegate, bridgeDelegate: RCTBridgeDelegate,',
      ],
      // (b) createRootView: remove spurious override
      [
        'public override func createRootView(reactDelegate: ExpoReactDelegate, bridge: RCTBridge,',
        'public func createRootView(reactDelegate: ExpoReactDelegate, bridge: RCTBridge,',
      ],
      // (c+d) unwrap optional bridge and rootViewInitialProperties
      [DEV_LAUNCHER_BRIDGE_BLOCK, DEV_LAUNCHER_BRIDGE_BLOCK_FIXED],
    ]
  );
}
