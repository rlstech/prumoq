// O NativeWind só é usado na build web (global.css em _layout.web.tsx e as
// className de app/(app)/print/[fvsId].web.tsx). No nativo o app usa
// StyleSheet puro.
//
// Aplicar `jsxImportSource: 'nativewind'` no nativo fazia o CssInterop envolver
// todo elemento JSX e **descartar `style` em forma de função** no Pressable —
// `style={({ pressed }) => [...]}` não chegava na view nativa, então as linhas
// perdiam flexDirection/padding/gap e empilhavam em coluna. Medido com
// onLayout: com style em função, tile.x=0 e body.x=0; com style estático,
// tile.x=16 e body.x=65.9. O padrão aparece ~39 vezes no app.
//
// api.cache.using (e não api.cache(true)) é obrigatório: o config agora depende
// da plataforma, e o cache precisa ser invalidado por plataforma.
module.exports = function (api) {
  const platform = api.caller(caller => caller?.platform);
  api.cache.using(() => platform);

  const isWeb = platform === 'web';

  return {
    presets: [
      ['babel-preset-expo', isWeb ? { jsxImportSource: 'nativewind' } : {}],
      ...(isWeb ? ['nativewind/babel'] : []),
    ],
  };
};
