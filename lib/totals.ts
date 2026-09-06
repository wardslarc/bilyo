import { roundHalfUp } from './money.ts';
import type { ILineItem } from '@/types';

export interface ComputeLineItemInput {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
}

export interface ComputeTotalsInput {
  items: ComputeLineItemInput[];
  discountCentavos?: number;
  vatRegistered: boolean;
  vatRatePercent?: number;
}

export interface ComputedTotals {
  items: ILineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  vatRatePercent: number;
  vatCentavos: number;
  totalCentavos: number;
}

/**
 * Recomputes totals from line items server-side (§3.3, §5.1, §5.2).
 * Rounding: compute line amounts first, sum, apply discount, then apply VAT.
 * Round half-up to the nearest centavo at each stored step.
 */
export function computeTotals({
  items,
  discountCentavos = 0,
  vatRegistered,
  vatRatePercent = 12,
}: ComputeTotalsInput): ComputedTotals {
  // 1. Line amounts
  const computedItems: ILineItem[] = items.map((item) => {
    const rawAmount = item.quantity * item.unitPriceCentavos;
    const amountCentavos = roundHalfUp(rawAmount);

    return {
      description: item.description,
      quantity: item.quantity,
      unitPriceCentavos: item.unitPriceCentavos,
      amountCentavos,
    };
  });

  // 2. Subtotal
  const subtotalCentavos = computedItems.reduce(
    (sum, item) => sum + item.amountCentavos,
    0
  );

  // 3. Discount applied before VAT (§5.2)
  const safeDiscount = Math.max(0, Math.min(discountCentavos, subtotalCentavos));
  const taxableCentavos = subtotalCentavos - safeDiscount;

  // 4. VAT (12% only if vatRegistered)
  let vatCentavos = 0;
  if (vatRegistered) {
    vatCentavos = roundHalfUp(taxableCentavos * (vatRatePercent / 100));
  }

  // 5. Total
  const totalCentavos = taxableCentavos + vatCentavos;

  return {
    items: computedItems,
    subtotalCentavos,
    discountCentavos: safeDiscount,
    vatRatePercent,
    vatCentavos,
    totalCentavos,
  };
}
