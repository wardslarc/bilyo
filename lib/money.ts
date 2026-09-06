/**
 * Domain rules for Money (§5.1)
 * All money is stored as integer centavos.
 * Conversion happens only at the display/PDF boundary.
 * Never parseFloat a peso string into storage.
 */

/**
 * Rounds a number half-up to the nearest integer.
 * e.g., 0.5 -> 1, 0.49 -> 0, -0.5 -> -1
 */
export function roundHalfUp(value: number): number {
  if (value >= 0) {
    return Math.floor(value + 0.5);
  }
  return Math.ceil(value - 0.5);
}

/**
 * Parses a peso string or number into integer centavos WITHOUT using parseFloat.
 * Handles commas, currency symbols (₱, PHP), whitespace, and fractional centavos
 * by rounding half-up at the 3rd decimal place (e.g., .005 -> 1 centavo).
 */
export function pesosToCentavos(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error('Invalid number provided to pesosToCentavos');
    }
    // Convert number to fixed string to avoid scientific notation
    input = input.toFixed(4);
  }

  // Sanitize input: remove currency symbols, commas, spaces
  let cleaned = input.replace(/[₱,\s]|PHP/gi, '').trim();

  if (!cleaned) {
    return 0;
  }

  const isNegative = cleaned.startsWith('-');
  if (isNegative || cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Match optional integer and decimal parts
  const match = cleaned.match(/^(\d+)?(?:\.(\d*))?$/);
  if (!match || (!match[1] && !match[2])) {
    throw new Error(`Invalid peso amount string: "${input}"`);
  }

  const intPartStr = match[1] || '0';
  const decPartStr = match[2] || '';

  // Extract up to 3 decimal digits to support half-up rounding at the .005 level
  const d1 = decPartStr.length > 0 ? Number.parseInt(decPartStr[0], 10) : 0;
  const d2 = decPartStr.length > 1 ? Number.parseInt(decPartStr[1], 10) : 0;
  const d3 = decPartStr.length > 2 ? Number.parseInt(decPartStr[2], 10) : 0;

  let centavosPart = d1 * 10 + d2;
  if (d3 >= 5) {
    centavosPart += 1;
  }

  const intPart = Number.parseInt(intPartStr, 10);
  const totalCentavos = intPart * 100 + centavosPart;

  return isNegative ? -totalCentavos : totalCentavos;
}

/**
 * Converts integer centavos to float pesos for input fields / calculations.
 */
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

/**
 * Formats integer centavos into a display string: ₱1,234.56
 */
export function formatMoney(centavos: number): string {
  const isNegative = centavos < 0;
  const absCentavos = Math.abs(centavos);
  const pesos = Math.floor(absCentavos / 100);
  const remainingCentavos = absCentavos % 100;

  const formattedPesos = pesos.toLocaleString('en-US');
  const formattedCentavos = remainingCentavos.toString().padStart(2, '0');

  const sign = isNegative ? '-' : '';
  return `${sign}₱${formattedPesos}.${formattedCentavos}`;
}
