// O servidor (Cloudflare Workers) roda sempre em UTC; o produto usa o horário de Brasília.
export const TIME_ZONE = 'America/Sao_Paulo';

/** Data de hoje (AAAA-MM-DD) em Brasília. `toISOString().slice(0, 10)` dá a data em UTC: depois das 21h já é amanhã. */
export function hojeEmBrasilia(): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
}
