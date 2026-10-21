const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

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

// ── React 18 do PWA ─────────────────────────────────────────────────
// A raiz do monorepo tem React 19 (admin Next 15); o Expo 52 precisa da cópia 18.3 que fica em
// apps/mobile/node_modules. Bibliotecas hoisted na raiz (expo-router, react-native-web...) achariam o 19,
// então `react`, `react-dom` e seus subcaminhos (react/jsx-runtime, react-dom/client...) são sempre
// resolvidos a partir deste app.
const singletonDeps = ['react', 'react-dom'];
const isSingleton = (name) => singletonDeps.some((dep) => name === dep || name.startsWith(dep + '/'));

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
  // Resolve direto pelo Node (sem os paths do tsconfig, que apontam `react` para os tipos @types/react).
  if (isSingleton(moduleName)) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [__dirname] }) };
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
