/**
 * Patches expo-dev-menu@4.5.8, expo-dev-launcher@3.6.10, and react-native@0.74.x
 * to fix iOS build errors with RN 0.74 + Xcode 15.
 *
 * Runs as a postinstall hook — works regardless of pnpm version (v9 or v10).
 * Files are unlinked before writing to break pnpm hardlinks to the global store.
 *
 * ── react-native ───────────────────────────────────────────────────────────
 *   0. Libraries/AppDelegate/RCTAppSetupUtils.h
 *      RN 0.74 removed JSCExecutorFactory.h but RCTAppSetupUtils.h still
 *      tries to include it when USE_HERMES is not defined. Replace the
 *      USE_HERMES preprocessor guard with __has_include checks so the header
 *      works regardless of whether USE_HERMES is propagated by the build system.
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
 * Objective-C (defence-in-depth — USE_HERMES guard in each importer):
 *   3. DevMenuRCTBridge.mm
 *   4. ReactNativeCompatibles/ReactNative/DevClientAppDelegate.mm
 *   5. ReactNativeCompatibles/ReactNative72/DevClientAppDelegate.mm
 *      Prepend `#ifndef USE_HERMES / #define USE_HERMES 1 / #endif` before
 *      RCTAppSetupUtils.h so JSCExecutorFactory.h is never included even if
 *      the react-native patch is not in effect for some reason.
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
 *
 * ── react-native-screens ───────────────────────────────────────────────────
 * Two distinct RN 0.74 Codegen bugs affect react-native-screens@4.x:
 *
 * Bug A — empty Readonly<{}> event payloads:
 *   RN 0.74 Codegen resolves Readonly<{}> as `undefined` (no-payload events
 *   must use `null`). Affected files:
 *   7.  src/fabric/ScreenStackHeaderConfigNativeComponent.ts
 *       `type OnAttachedEvent/OnDetachedEvent = Readonly<{}>` → `null`
 *   8.  src/fabric/ScreenNativeComponent.ts
 *       `type ScreenEvent = Readonly<{}>` → `null`
 *   9.  src/fabric/ModalScreenNativeComponent.ts
 *       `type ScreenEvent = Readonly<{}>` → `null`
 *   10. src/fabric/ScreenStackNativeComponent.ts
 *       `type FinishTransitioningEvent = Readonly<{}>` → `null`
 *   11. src/fabric/SearchBarNativeComponent.ts
 *       `export type SearchBarEvent = Readonly<{}>` → `null`
 *   12. src/fabric/gamma/SplitViewHostNativeComponent.ts
 *       `type GenericEmptyEvent = Readonly<{}>` → `null`
 *   13. src/fabric/gamma/SplitViewScreenNativeComponent.ts
 *       `type GenericEmptyEvent = Readonly<{}>` → `null`
 *   14. src/fabric/gamma/stack/StackScreenNativeComponent.ts
 *       `type GenericEmptyEvent = Readonly<{}>` → `null`
 *   15. src/fabric/tabs/TabsScreenNativeComponent.ts
 *       `type GenericEmptyEvent = Readonly<{}>` → `null`
 *
 * Bug B — exported string-union type alias in CT.WithDefault<T, ...>:
 *   RN 0.74 Codegen treats `export type T` as an external reference and
 *   fails to resolve it, returning `undefined`. Non-exported aliases work.
 *   Fix: remove `export` so Codegen resolves the alias inline.
 *   16. src/fabric/ScreenStackHeaderSubviewNativeComponent.ts
 *       `export type HeaderSubviewTypes =` → `type HeaderSubviewTypes =`
 *   17. src/fabric/tabs/TabsScreenNativeComponent.ts
 *       `export type IconType =` → `type IconType =`
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Resolve workspace root relative to THIS FILE so the script works when
// invoked from any CWD — root postinstall, apps/mobile postinstall, or a
// custom build step. (scripts/ lives directly in the workspace root.)
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

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

// RCTAppSetupUtils.h: the block that gates on USE_HERMES. In RN 0.74, JSCExecutorFactory.h
// was removed, so any build where USE_HERMES isn't propagated fails. Replace with
// __has_include so the choice is made at compile time based on file existence.
const RCT_APP_SETUP_UTILS_JSC_BLOCK = `#if USE_HERMES
#if __has_include(<jsireact/HermesExecutorFactory.h>)
#import <jsireact/HermesExecutorFactory.h>
#elif __has_include(<reacthermes/HermesExecutorFactory.h>)
#import <reacthermes/HermesExecutorFactory.h>
#endif
#else // USE_HERMES
#import <React/JSCExecutorFactory.h>
#endif // USE_HERMES`;

const RCT_APP_SETUP_UTILS_JSC_BLOCK_FIXED = `// Patched: use __has_include instead of USE_HERMES so this header works
// regardless of whether the build system propagates the USE_HERMES macro.
// JSCExecutorFactory.h was removed in RN 0.74; omitting it is safe when Hermes is used.
#if __has_include(<jsireact/HermesExecutorFactory.h>)
#import <jsireact/HermesExecutorFactory.h>
#elif __has_include(<reacthermes/HermesExecutorFactory.h>)
#import <reacthermes/HermesExecutorFactory.h>
#elif __has_include(<React/JSCExecutorFactory.h>)
#import <React/JSCExecutorFactory.h>
#endif`;

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

    // createRootView(with:moduleName:initProps:) returns UIView (non-optional)
    let rootView = bridgeDelegateHandler.createRootView(
      with: bridge,
      // swiftlint:disable:next force_unwrapping
      moduleName: self.rootViewModuleName!,
      initProps: self.rootViewInitialProperties ?? [:]
    )`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function findPackageRoot(pkgPrefix) {
  const roots = findAllPackageRoots(pkgPrefix);
  return roots.length > 0 ? roots[0] : null;
}

// Returns every virtual-store instance of a package whose directory name
// starts with pkgPrefix.  pnpm can install the same package multiple times
// under different peer-dep hashes; we must patch all of them.
function findAllPackageRoots(pkgPrefix) {
  const virtualStore = path.join(WORKSPACE_ROOT, 'node_modules', '.pnpm');
  if (!fs.existsSync(virtualStore)) {
    const flat = path.join(WORKSPACE_ROOT, 'node_modules', pkgPrefix.split('@')[0]);
    return fs.existsSync(flat) ? [flat] : [];
  }
  const pkgName = pkgPrefix.split('@')[0];
  const results = [];
  for (const entry of fs.readdirSync(virtualStore)) {
    if (entry.startsWith(pkgPrefix)) {
      const candidate = path.join(virtualStore, entry, 'node_modules', pkgName);
      if (fs.existsSync(candidate)) results.push(candidate);
    }
  }
  return results;
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
    console.log(`[patch-native-deps] already patched: ${path.relative(WORKSPACE_ROOT, filePath)}`);
    return;
  }

  // Unlink before writing to break the pnpm hardlink to the global store.
  fs.unlinkSync(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-native-deps] patched: ${path.relative(WORKSPACE_ROOT, filePath)}`);
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
      // (c+d) unwrap optional bridge; use let (not guard let) for non-optional rootView
      [DEV_LAUNCHER_BRIDGE_BLOCK, DEV_LAUNCHER_BRIDGE_BLOCK_FIXED],
      // Idempotency: if a prior patch run left guard let rootView (wrong), fix it
      [
        `    guard let rootView = bridgeDelegateHandler.createRootView(\n      with: bridge,\n      // swiftlint:disable:next force_unwrapping\n      moduleName: self.rootViewModuleName!,\n      initProps: self.rootViewInitialProperties ?? [:]\n    ) else {\n      return\n    }`,
        `    // createRootView(with:moduleName:initProps:) returns UIView (non-optional)\n    let rootView = bridgeDelegateHandler.createRootView(\n      with: bridge,\n      // swiftlint:disable:next force_unwrapping\n      moduleName: self.rootViewModuleName!,\n      initProps: self.rootViewInitialProperties ?? [:]\n    )`,
      ],
    ]
  );
}

// ── react-native patches ────────────────────────────────────────────────────

const rnRoot = findPackageRoot('react-native@0.74.');
if (!rnRoot) {
  console.log('[patch-native-deps] react-native not found, skipping');
} else {
  patchFile(
    path.join(rnRoot, 'Libraries', 'AppDelegate', 'RCTAppSetupUtils.h'),
    [[RCT_APP_SETUP_UTILS_JSC_BLOCK, RCT_APP_SETUP_UTILS_JSC_BLOCK_FIXED]]
  );
}

// ── react-native-screens patches ────────────────────────────────────────────
//
// react-native-screens (3.x and 4.x) defines event payload types as
// Readonly<{}> (empty object).  React Native 0.74's Codegen parser treats that
// as `undefined` and aborts with "Unknown prop type for …: undefined".
// Changing the aliases to `null` is the correct form for no-payload events
// in RN 0.74 Codegen.
//
// Version-agnostic: we match any installed version of react-native-screens so
// this script works regardless of whether pnpm resolves 3.37.0 or 4.24.0.
// pnpm can also install the same package multiple times under different
// peer-dep hashes; findAllPackageRoots returns every virtual-store instance.
const rnScreensRoots = findAllPackageRoots('react-native-screens@');
if (rnScreensRoots.length === 0) {
  console.log('[patch-native-deps] react-native-screens not found, skipping');
} else {
  for (const rnScreensRoot of rnScreensRoots) {
    const fabricDir = path.join(rnScreensRoot, 'src', 'fabric');

    // ScreenStackHeaderConfigNativeComponent.ts — OnAttachedEvent, OnDetachedEvent
    patchFile(
      path.join(fabricDir, 'ScreenStackHeaderConfigNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype OnAttachedEvent = Readonly<{}>;\n// eslint-disable-next-line @typescript-eslint/ban-types\ntype OnDetachedEvent = Readonly<{}>;',
          'type OnAttachedEvent = null;\ntype OnDetachedEvent = null;',
        ],
      ]
    );

    // ScreenNativeComponent.ts — ScreenEvent
    patchFile(
      path.join(fabricDir, 'ScreenNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype ScreenEvent = Readonly<{}>;',
          'type ScreenEvent = null;',
        ],
      ]
    );

    // ModalScreenNativeComponent.ts — ScreenEvent (identical pattern)
    patchFile(
      path.join(fabricDir, 'ModalScreenNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype ScreenEvent = Readonly<{}>;',
          'type ScreenEvent = null;',
        ],
      ]
    );

    // ScreenStackNativeComponent.ts — FinishTransitioningEvent
    patchFile(
      path.join(fabricDir, 'ScreenStackNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype FinishTransitioningEvent = Readonly<{}>;',
          'type FinishTransitioningEvent = null;',
        ],
      ]
    );

    // SearchBarNativeComponent.ts — SearchBarEvent (exported)
    // 4.x has a per-line eslint-disable comment; 3.37.0 only has a file-top
    // /* eslint-disable */ so we need both patterns (tried in order; whichever
    // matches first wins — after replacement the other won't match anyway).
    patchFile(
      path.join(fabricDir, 'SearchBarNativeComponent.ts'),
      [
        // 4.x format: per-line eslint-disable comment present
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\nexport type SearchBarEvent = Readonly<{}>;',
          'export type SearchBarEvent = null;',
        ],
        // 3.37.0 format: no per-line comment (file has /* eslint-disable */ at top)
        [
          'export type SearchBarEvent = Readonly<{}>;',
          'export type SearchBarEvent = null;',
        ],
      ]
    );

    // ── Bug B: exported string-union type alias in CT.WithDefault ─────────────
    // RN 0.74 Codegen treats `export type T` as an external reference and
    // returns `undefined` instead of resolving the string union inline.
    // Fix: remove `export` so the alias is resolved as a module-local type.

    // ScreenStackHeaderSubviewNativeComponent.ts — HeaderSubviewTypes
    patchFile(
      path.join(fabricDir, 'ScreenStackHeaderSubviewNativeComponent.ts'),
      [['export type HeaderSubviewTypes =', 'type HeaderSubviewTypes =']]
    );

    // ── Subdirectory fabric files ─────────────────────────────────────────────

    // gamma/SplitViewHostNativeComponent.ts — GenericEmptyEvent
    patchFile(
      path.join(fabricDir, 'gamma', 'SplitViewHostNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype GenericEmptyEvent = Readonly<{}>;',
          'type GenericEmptyEvent = null;',
        ],
      ]
    );

    // gamma/SplitViewScreenNativeComponent.ts — GenericEmptyEvent
    patchFile(
      path.join(fabricDir, 'gamma', 'SplitViewScreenNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype GenericEmptyEvent = Readonly<{}>;',
          'type GenericEmptyEvent = null;',
        ],
      ]
    );

    // gamma/stack/StackScreenNativeComponent.ts — GenericEmptyEvent
    patchFile(
      path.join(fabricDir, 'gamma', 'stack', 'StackScreenNativeComponent.ts'),
      [
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype GenericEmptyEvent = Readonly<{}>;',
          'type GenericEmptyEvent = null;',
        ],
      ]
    );

    // tabs/TabsScreenNativeComponent.ts — GenericEmptyEvent + IconType (Bug A + B)
    patchFile(
      path.join(fabricDir, 'tabs', 'TabsScreenNativeComponent.ts'),
      [
        // Bug A: empty event payload
        [
          '// eslint-disable-next-line @typescript-eslint/ban-types\ntype GenericEmptyEvent = Readonly<{}>;',
          'type GenericEmptyEvent = null;',
        ],
        // Bug B: exported string-union in CT.WithDefault
        ['export type IconType = ', 'type IconType = '],
      ]
    );
  }
}
