const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web platform aliases — only active for platform === 'web'
const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
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
