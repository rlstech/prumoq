import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextVitals,
  {
    // Regras novas do React Compiler (eslint-config-next 16). Ficam como aviso: apontam padrões
    // em código antigo que funciona; corrigir aos poucos.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/error-boundaries': 'warn',
    },
  },
  { ignores: ['.next/**', '.open-next/**', '.wrangler/**', 'node_modules/**', 'next-env.d.ts'] },
];

export default config;
