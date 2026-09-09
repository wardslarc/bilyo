export interface ClientQuotationStats {
  totalQuotedCentavos: number;
  totalAcceptedCentavos: number;
  quotationCount: number;
  acceptedCount: number;
}

/**
 * Computes quotation summary metrics for a client's quote history.
 */
export function computeClientQuotationStats(
  quotations: Array<{ status: string; totalCentavos: number }>
): ClientQuotationStats {
  let totalQuotedCentavos = 0;
  let totalAcceptedCentavos = 0;
  let acceptedCount = 0;

  for (const q of quotations) {
    totalQuotedCentavos += q.totalCentavos || 0;
    if (q.status === 'ACCEPTED') {
      totalAcceptedCentavos += q.totalCentavos || 0;
      acceptedCount++;
    }
  }

  return {
    totalQuotedCentavos,
    totalAcceptedCentavos,
    quotationCount: quotations.length,
    acceptedCount,
  };
}
