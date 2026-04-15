/**
 * Patches expo-dev-menu@4.5.8 Swift files to fix build errors with Xcode 15+.
 *
 * This runs as a postinstall hook so it works regardless of pnpm version (v9 or v10).
 * Files are unlinked before writing to break pnpm hardlinks to the global store.
 *
 * Fixes:
 *   1. DevMenuAppInstance.swift:55
 *      `-> [RCTBridgeModule]!` → `-> [RCTBridgeModule]`
 *      (base class return type is non-optional in newer RN)
 *
 *   2. ExpoDevMenuReactDelegateHandler.swift:24
 *      `public override func createRootView` → `public func createRootView`
 *      (method no longer exists on superclass)
 */

'use strict';

const fs = require('fs');
const path = require('path');

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

patchFile(
  path.join(devMenuRoot, 'ios', 'DevMenuAppInstance.swift'),
  [['-> [RCTBridgeModule]!', '-> [RCTBridgeModule]']]
);

patchFile(
  path.join(devMenuRoot, 'ios', 'ReactDelegateHandler', 'ExpoDevMenuReactDelegateHandler.swift'),
  [['public override func createRootView(reactDelegate:', 'public func createRootView(reactDelegate:']]
);
