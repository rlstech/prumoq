const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// ── Monorepo: watch packages above apps/mobile ──────────────
const monorepoRoot = path.resolve(__dirname, '../..');
config.watchFolders = [monorepoRoot];

// Exclude apps/web's Next.js build output from Metro's watcher.
// `.next/` churns constantly during `next dev` (files/dirs created and
// removed as routes compile) and Metro's FallbackWatcher on Windows can
// throw ENOENT if a directory disappears between crawl and fs.watch().
// Since the mobile app never needs to resolve/watch anything under
// apps/web, block it outright rather than let the two dev servers race.
config.resolver.blockList = [
  config.resolver.blockList,
  /[\\/]apps[\\/]web[\\/]\.next[\\/].*/,
].filter(Boolean);

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

// ── PowerSync Web ───────────────────────────────────────────────────
// O @powersync/web publica uma build própria para React Native Web na condição
// de export `react-native-web` (sem `new URL(..., import.meta.url)`, que o Metro
// não entende). Os workers vêm de public/powersync (ver lib/powersync.ts).
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: [...(config.resolver.unstable_conditionsByPlatform?.web ?? ['browser']), 'react-native-web'],
};

// ── Custom resolver: singleton enforcement ──────────────────────────
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  // Force singleton deps to always resolve to the same canonical copy
  if (singletonMap[moduleName]) {
    return {
      filePath: path.join(singletonMap[moduleName], 'index.js'),
      type: 'sourceFile',
    };
  }

  // O @powersync/web importa o wa-sqlite (arquivos .mjs com `import.meta`) só para o modo
  // sem worker. O app sempre roda o SQLite no worker de public/powersync, e `import.meta`
  // num bundle clássico do Metro quebra a página inteira ("Cannot use 'import.meta'
  // outside a module"). Então, no navegador, esses módulos viram vazios.
  if (platform === 'web' && moduleName.startsWith('@journeyapps/wa-sqlite')) {
    return { type: 'empty' };
  }

  if (originalResolve) {
    return originalResolve(ctx, moduleName, platform);
  }
  return ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
