const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// ── Monorepo: watch packages above apps/mobile ──────────────
const monorepoRoot = path.resolve(__dirname, '../..');
config.watchFolders = [monorepoRoot];

// ── Deduplicate singleton packages (pnpm creates multiple copies) ───
// Resolve to the REAL path (not symlink) so Metro sees one canonical location
const singletonDeps = ['react', 'react-dom', 'react-native', 'react-native-web'];
const singletonMap = {};
for (const dep of singletonDeps) {
  const depPath = path.resolve(__dirname, 'node_modules', dep);
  try {
    singletonMap[dep] = fs.realpathSync(depPath);
  } catch {
    // dep not installed (e.g. react-dom may not exist) — skip
  }
}

// Ensure Metro can resolve modules from both the app and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// ── Custom resolver: singleton enforcement + web platform aliases ───
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  // Force singleton deps to always resolve to the same canonical copy
  if (singletonMap[moduleName]) {
    return {
      filePath: path.join(singletonMap[moduleName], 'index.js'),
      type: 'sourceFile',
    };
  }

  if (platform === 'web') {
    // Replace PowerSync (requires native SQLite) with Supabase-backed shim
    if (moduleName === '@powersync/react-native') {
      return {
        filePath: path.resolve(__dirname, 'lib/powersync-web-shim.ts'),
        type: 'sourceFile',
      };
    }
  }
  if (originalResolve) {
    return originalResolve(ctx, moduleName, platform);
  }
  return ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
