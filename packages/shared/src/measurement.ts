export type Decimal = string;

const SCALE = 1_000_000;

function parse(value: Decimal): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error('Decimal inválido');
  const negative = value.startsWith('-');
  const [wholeRaw, fractionRaw = ''] = (negative ? value.slice(1) : value).split('.');
  const fraction = `${fractionRaw}000000`.slice(0, 6);
  const parsed = Number(wholeRaw) * SCALE + Number(fraction);
  if (!Number.isSafeInteger(parsed)) throw new Error('Decimal fora do limite seguro');
  return negative ? -parsed : parsed;
}

function format(value: number): Decimal {
  const negative = value < 0;
  const absolute = negative ? -value : value;
  const whole = Math.trunc(absolute / SCALE);
  const fraction = Math.trunc(absolute % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function calculateAvailable(approved: Decimal, measured: Decimal, blocked: Decimal): Decimal {
  const available = parse(approved) - parse(measured) - parse(blocked);
  return format(available > 0 ? available : 0);
}

export function calculateMeasurementValue(quantity: Decimal, unitPrice: Decimal | null): Decimal {
  if (unitPrice === null) return '0';
  const cents = (parse(quantity) * parse(unitPrice)) / SCALE;
  return format(cents);
}

export function weightsTotal(weights: readonly Decimal[]): Decimal {
  return format(weights.reduce((total, weight) => total + parse(weight), 0));
}

export function hasExactStageWeights(weights: readonly Decimal[]): boolean {
  return weightsTotal(weights) === '100';
}

export function cumulativeDelta(previous: Decimal, current: Decimal): Decimal {
  const delta = parse(current) - parse(previous);
  if (delta < 0) throw new Error('O acumulado não pode ser reduzido');
  return format(delta);
}

export function validateApprovedProgress(input: {
  previousExecuted: Decimal;
  previousApproved: Decimal;
  executed: Decimal;
  approved: Decimal;
  assignedScope: Decimal;
  partialAllowed: boolean;
}): string | null {
  const previousExecuted = parse(input.previousExecuted);
  const previousApproved = parse(input.previousApproved);
  const executed = parse(input.executed);
  const approved = parse(input.approved);
  const scope = parse(input.assignedScope);
  if (executed < previousExecuted || approved < previousApproved) return 'O avanço acumulado não pode ser reduzido.';
  if (approved > executed) return 'O avanço aprovado não pode superar o executado.';
  if (executed > scope || approved > scope) return 'O avanço não pode superar o escopo atribuído.';
  if (!input.partialAllowed && approved !== 0 && approved !== scope) return 'Etapa binária exige aprovação integral.';
  return null;
}

export function calculateContractorTransfer(input: {
  assignedScope: Decimal;
  executed: Decimal;
  approved: Decimal;
  measured: Decimal;
}): { previousApprovedBalance: Decimal; newContractorScope: Decimal } {
  const scope = parse(input.assignedScope);
  const executed = parse(input.executed);
  const approved = parse(input.approved);
  const measured = parse(input.measured);
  if (approved > executed || measured > approved || executed > scope) throw new Error('Histórico de execução inválido');
  return {
    previousApprovedBalance: format(approved - measured),
    newContractorScope: format(scope - executed),
  };
}
