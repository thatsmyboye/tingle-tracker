/**
 * Root-level Metro config used by EAS Build, which runs from the repo root.
 *
 * Key concerns:
 *  1. pnpm stores packages in node_modules/.pnpm/<pkg>/<hash>/node_modules/<pkg>,
 *     so Metro needs to watch the full monorepo root, not just apps/mobile.
 *  2. Symlinks from node_modules/<pkg> → .pnpm virtual store must be followed.
 *  3. Source files live under apps/mobile, so that subtree must be watched too.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const monorepoRoot = __dirname;
const mobileRoot = path.resolve(monorepoRoot, 'apps/mobile');

const config = getDefaultConfig(monorepoRoot);

// Watch both the monorepo root (for hoisted node_modules/.pnpm) and the
// mobile app directory (for source files).
config.watchFolders = [monorepoRoot, mobileRoot];

// Tell Metro where to look for node_modules — the hoisted pnpm virtual store
// at the monorepo root covers all packages.
config.resolver.nodeModulesPaths = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(mobileRoot, 'node_modules'),
];

// pnpm uses symlinks; Metro must follow them to reach the virtual store.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
