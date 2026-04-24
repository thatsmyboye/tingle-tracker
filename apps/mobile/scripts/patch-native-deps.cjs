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
 *   must use a bare `{}` empty object literal that Codegen treats as an empty
 *   struct; replacing with `null` via a type alias also fails).
 *   Affected: any fabric spec with `type X = Readonly<{}>`.
 *
 * Bug B — exported string-union type alias in CT.WithDefault<T, ...>:
 *   RN 0.74 Codegen treats `export type T` as an external reference and
 *   fails to resolve it, returning `undefined`. Non-exported aliases work.
 *   Fix: remove `export` so Codegen resolves the alias inline.
 *   Affected files (specific aliases):
 *     ScreenStackHeaderSubviewNativeComponent.ts — HeaderSubviewTypes
 *     tabs/TabsScreenNativeComponent.ts          — IconType
 *
 * Bug C — CT namespace alias for CodegenTypes props:
 *   RN 0.74 Codegen cannot resolve qualified type references such as
 *   CT.WithDefault<boolean, true> (where CT = CodegenTypes namespace alias).
 *   The TypeScript resolver returns `undefined` for every prop that uses CT.*,
 *   producing "Unknown prop type for '…': 'undefined'" at build time.
 *   Fix: remove the `CodegenTypes as CT` alias from the react-native import,
 *   add a direct import from 'react-native/Libraries/Types/CodegenTypes', and
 *   strip the `CT.` qualifier from all usages throughout each spec file.
 *   Affected: all fabric spec files in react-native-screens@4.x.
 *
 * Bug D — DirectEventHandler<T> | null union on event handler props:
 *   RN 0.74 Codegen cannot handle a TSUnionType as an event prop type.
 *   When it encounters `DirectEventHandler<T> | null`, it tries to extract
 *   the event type name from the union (which has no name) and aborts:
 *   "typeAnnotation of event doesn't have a name".
 *   Fix: strip the ` | null` suffix so the prop is a plain DirectEventHandler.
 *
 * All four patches (A–D) are applied to every *NativeComponent.ts file found
 * recursively under src/fabric/ so that newly-added spec files are covered
 * automatically without updating this list.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Walk up from startDir until we find the pnpm workspace root (identified by
// pnpm-workspace.yaml or node_modules/.pnpm). This works whether the script
// is invoked from the monorepo root scripts/ directory, from apps/mobile/scripts/
// (inside the EAS build environment), or from anywhere else.
function findWorkspaceRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(dir, 'node_modules', '.pnpm'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const WORKSPACE_ROOT = findWorkspaceRoot(path.resolve(__dirname, '..'));

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

// Recursively collects every *NativeComponent.ts file under `dir`.
// Used to patch all react-native-screens fabric spec files in one pass
// without maintaining a hand-curated list that would miss new files.
function findFabricSpecFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFabricSpecFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('NativeComponent.ts')) {
      results.push(fullPath);
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
    if (from instanceof RegExp) {
      // RegExp replacement — compare before/after to detect a real change.
      const next = content.replace(from, to);
      if (next !== content) {
        content = next;
        changed = true;
      }
    } else if (content.includes(from)) {
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
//
// Bug A — empty Readonly<{}> event payloads:
//   The exact string forms in the npm-published source can vary across point
//   releases (trailing spaces, CRLF vs LF, missing eslint-disable comment on
//   one of the two lines, etc.).  Using exact string matching has proven
//   fragile, so we now use a RegExp that:
//     • optionally strips a preceding eslint-disable-next-line comment
//     • matches the type alias regardless of surrounding whitespace
//     • works with/without the `export` keyword (SearchBarEvent keeps export)
//
// Bug B — exported string-union type alias in CT.WithDefault:
//   RN 0.74 Codegen treats `export type T` as an external reference and
//   returns `undefined` instead of resolving the string union inline.
//   Fix: remove `export` so the alias is resolved as a module-local type.
//   This only affects a small number of identifiers; exact string is fine.

// Regex for Bug A: matches any `type X = Readonly<{}>` (with or without an
// eslint-disable-next-line comment on the preceding line, with or without
// `export`).  The `g` flag replaces every occurrence in a single pass.
const RN_SCREENS_READONLY_EMPTY =
  /(?:[ \t]*\/\/\s*eslint-disable(?:-next-line)?\s[^\n]*\n)?(\s*(?:export\s+)?type\s+\w+\s*=\s*)Readonly<\{\}>;/g;

// Regex for Bug C (single-line import form):
//   import type { CodegenTypes as CT, ViewProps } from 'react-native';
// Captures the non-CT named imports in group 1.
// Idempotent: after replacement, `CodegenTypes as CT` is gone so re-run is a no-op.
const RN_SCREENS_CT_IMPORT =
  /^import type \{ CodegenTypes as CT, ([^}]+)\} from 'react-native';?$/m;

// Replacement: keep the non-CT types and add a direct CodegenTypes import.
// Note: UnsafeMixed is intentionally excluded — it is recognised by Codegen
// by name alone (not by import source), so no import is needed after stripping
// the CT. prefix. Some files already import a local UnsafeMixed<T> generic
// from './codegenUtils'; adding it again here would cause a duplicate-identifier
// error (tabs/TabsScreenNativeComponent.ts).
const RN_SCREENS_CT_IMPORT_FIXED =
  "import type { $1} from 'react-native';\n" +
  "import type { BubblingEventHandler, DirectEventHandler, Double, Float, Int32, WithDefault } from 'react-native/Libraries/Types/CodegenTypes';";

// Regex for Bug C (multi-line import form):
//   import type {
//     CodegenTypes as CT,
//     ViewProps,
//     ...
//   } from 'react-native';
// Group 1 = the CT line ("\n  CodegenTypes as CT,"), group 2 = remaining lines.
// Atomic replacement is idempotent: second run finds no CT line → no match.
const RN_SCREENS_CT_IMPORT_ML =
  /import type \{(\s*\n[ \t]+CodegenTypes as CT,)([\s\S]*?)\} from 'react-native';?/;

const RN_SCREENS_CT_IMPORT_ML_FIXED =
  "import type {$2} from 'react-native';\n" +
  "import type { BubblingEventHandler, DirectEventHandler, Double, Float, Int32, WithDefault } from 'react-native/Libraries/Types/CodegenTypes';";

// Regex for Bug C: strips the `CT.` qualifier from any CodegenTypes usage.
// The `g` flag replaces every occurrence in a single pass.
// UnsafeMixed is included so CT.UnsafeMixed[] (header config) is de-qualified;
// it is NOT added to the CodegenTypes import because Codegen recognises it by
// name alone and some files already have a local UnsafeMixed<T> from codegenUtils.
const RN_SCREENS_CT_PREFIX =
  /\bCT\.(WithDefault|DirectEventHandler|BubblingEventHandler|Float|Int32|Double|UnsafeMixed)\b/g;

// Regex for Bug D: strips the ` | null` suffix from event handler prop types.
// RN 0.74 Codegen cannot process a TSUnionType (DirectEventHandler<T> | null)
// as an event prop — it must be a plain DirectEventHandler<T>.
// Applied after Bug C so that `CT.DirectEventHandler` is already bare.
const RN_SCREENS_EVENT_NULL_UNION =
  /\b(DirectEventHandler|BubblingEventHandler)(<[^>]+>)\s*\|\s*null/g;

const rnScreensRoots = findAllPackageRoots('react-native-screens@');
if (rnScreensRoots.length === 0) {
  console.log('[patch-native-deps] react-native-screens not found, skipping');
} else {
  for (const rnScreensRoot of rnScreensRoots) {
    const fabricDir = path.join(rnScreensRoot, 'src', 'fabric');

    // ── Bugs A / C / D: apply to every *NativeComponent.ts under src/fabric/ ──
    //
    // Using findFabricSpecFiles() instead of a hand-curated list so that any
    // newly-added spec files are covered automatically.  Each patch is a no-op
    // for files that don't contain the target pattern, so there is no risk of
    // accidentally corrupting files that don't need the fix.
    const allFabricSpecFiles = findFabricSpecFiles(fabricDir);
    if (allFabricSpecFiles.length === 0) {
      console.log(`[patch-native-deps] no NativeComponent.ts files found under ${fabricDir}`);
    }

    for (const filePath of allFabricSpecFiles) {
      patchFile(filePath, [
        // Bug A: Readonly<{}> → {} (bare empty object literal that Codegen
        // recognises as an empty struct; `null` via type alias also fails).
        [RN_SCREENS_READONLY_EMPTY, '$1{};'],
        // Bug C (single-line import): remove CT alias, add direct CodegenTypes.
        [RN_SCREENS_CT_IMPORT, RN_SCREENS_CT_IMPORT_FIXED],
        // Bug C (multi-line import): atomic replace — idempotent on re-run.
        [RN_SCREENS_CT_IMPORT_ML, RN_SCREENS_CT_IMPORT_ML_FIXED],
        // Bug C: strip CT. qualifier from all CodegenTypes usages.
        [RN_SCREENS_CT_PREFIX, '$1'],
        // Bug D: strip " | null" from DirectEventHandler / BubblingEventHandler
        // prop types — Codegen can't handle a union type as an event prop.
        [RN_SCREENS_EVENT_NULL_UNION, '$1$2'],
      ]);
    }

    // ── Bug B: exported string-union type alias in CT.WithDefault ─────────────
    // Applied after the main loop (Bugs A/C/D already handled above).

    patchFile(
      path.join(fabricDir, 'ScreenStackHeaderSubviewNativeComponent.ts'),
      [['export type HeaderSubviewTypes =', 'type HeaderSubviewTypes =']]
    );

    patchFile(
      path.join(fabricDir, 'tabs', 'TabsScreenNativeComponent.ts'),
      [['export type IconType = ', 'type IconType = ']]
    );
  }
}
