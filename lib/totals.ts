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
}

export interface ComputedTotals {
  items: ILineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
}

/**
 * Recomputes totals from line items server-side (§3.3, §5.1).
 * Formula: subtotal -> discount -> total.
 * Round half-up to the nearest centavo at each stored step.
 * No tax computation (AGENTS.md §3, §4.3).
 */
export function computeTotals({
  items,
  discountCentavos = 0,
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

  // 3. Discount
  const safeDiscount = Math.max(0, Math.min(discountCentavos, subtotalCentavos));

  // 4. Total: subtotal - discount
  const totalCentavos = subtotalCentavos - safeDiscount;

  return {
    items: computedItems,
    subtotalCentavos,
    discountCentavos: safeDiscount,
    totalCentavos,
  };
}
