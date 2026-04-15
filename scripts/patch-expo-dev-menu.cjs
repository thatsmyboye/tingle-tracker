/**
 * Patches expo-dev-menu@4.5.8 to fix iOS build errors with RN 0.74 + Xcode 15.
 *
 * This runs as a postinstall hook so it works regardless of pnpm version (v9 or v10).
 * Files are unlinked before writing to break pnpm hardlinks to the global store.
 *
 * Swift fixes (Xcode 15 strict type checking):
 *   1. DevMenuAppInstance.swift:55
 *      `-> [RCTBridgeModule]!` → `-> [RCTBridgeModule]`
 *      (base class return type is non-optional)
 *
 *   2. ExpoDevMenuReactDelegateHandler.swift:24
 *      `public override func createRootView` → `public func createRootView`
 *      (method no longer exists on superclass)
 *
 * Objective-C fix (RN 0.74 removed JSCExecutorFactory.h):
 *   3. DevMenuRCTBridge.mm
 *   4. ReactNativeCompatibles/ReactNative/DevClientAppDelegate.mm
 *   5. ReactNativeCompatibles/ReactNative72/DevClientAppDelegate.mm
 *      All three include RCTAppSetupUtils.h which pulls in JSCExecutorFactory.h
 *      when USE_HERMES is not pre-defined. Fix: ensure USE_HERMES=1 is set
 *      before that header is processed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// The exact block that appears in all three .mm files
const RCT_APP_SETUP_IMPORT = `#if __has_include(<React_RCTAppDelegate/RCTAppSetupUtils.h>)
// for importing the header from framework, the dash will be transformed to underscore
#import <React_RCTAppDelegate/RCTAppSetupUtils.h>
#else
#import <React-RCTAppDelegate/RCTAppSetupUtils.h>
#endif`;

// Prepend USE_HERMES guard so the JSCExecutorFactory.h branch is never taken
const RCT_APP_SETUP_IMPORT_FIXED = `// RN 0.74 removed JSCExecutorFactory.h; guard against its inclusion when
// the USE_HERMES build setting isn't propagated to this translation unit.
#ifndef USE_HERMES
#define USE_HERMES 1
#endif
${RCT_APP_SETUP_IMPORT}`;

function findDevMenuRoot() {
  // Walk the pnpm virtual store looking for expo-dev-menu@4.5.8
  const virtualStore = path.join(process.cwd(), 'node_modules', '.pnpm');
  if (!fs.existsSync(virtualStore)) {
    // Flat node_modules layout (npm/yarn fallback)
    const flat = path.join(process.cwd(), 'node_modules', 'expo-dev-menu');
    return fs.existsSync(flat) ? flat : null;
  }

  const entries = fs.readdirSync(virtualStore);
  for (const entry of entries) {
    if (entry.startsWith('expo-dev-menu@4.5.8')) {
      const candidate = path.join(virtualStore, entry, 'node_modules', 'expo-dev-menu');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function patchFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-expo-dev-menu] not found, skipping: ${filePath}`);
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
    console.log(`[patch-expo-dev-menu] already patched: ${path.relative(process.cwd(), filePath)}`);
    return;
  }

  // Unlink before writing to break the pnpm hardlink to the global store,
  // so we don't accidentally mutate the shared cache.
  fs.unlinkSync(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-expo-dev-menu] patched: ${path.relative(process.cwd(), filePath)}`);
}

const devMenuRoot = findDevMenuRoot();
if (!devMenuRoot) {
  console.log('[patch-expo-dev-menu] expo-dev-menu not found in node_modules, skipping');
  process.exit(0);
}

// --- Swift fixes ---

patchFile(
  path.join(devMenuRoot, 'ios', 'DevMenuAppInstance.swift'),
  [['-> [RCTBridgeModule]!', '-> [RCTBridgeModule]']]
);

patchFile(
  path.join(devMenuRoot, 'ios', 'ReactDelegateHandler', 'ExpoDevMenuReactDelegateHandler.swift'),
  [['public override func createRootView(reactDelegate:', 'public func createRootView(reactDelegate:']]
);

// --- Objective-C fixes (JSCExecutorFactory.h) ---

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
