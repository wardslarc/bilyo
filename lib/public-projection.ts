import dbConnect from './mongodb.ts';
import { Quotation } from '../models/quotation.ts';
import { User } from '../models/user.ts';
import { Business } from '../models/business.ts';
import { Customer } from '../models/customer.ts';
import type { DocumentStatus } from './documents.ts';

export interface PublicLineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

export interface PublicBusiness {
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  logoUrl?: string | null;
}

export interface PublicCustomer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * Hand-written minimal projection for public links (§5.6).
 * STRICT PROHIBITIONS:
 * - NO user account email
 * - NO internal ObjectIds (_id, userId, customerId)
 * - NO other document references
 */
export interface PublicDocumentProjection {
  kind: 'quotation';
  number: string;
  status: DocumentStatus;
  issueDate: string;
  secondaryDateLabel: string;
  secondaryDate: string;
  paidAt?: string | null;
  items: PublicLineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
  notes?: string;
  terms?: string;
  business: PublicBusiness;
  customer: PublicCustomer;
}

/**
 * Validates a public token format (must be 12-char URL-safe base64 string).
 */
export function isValidPublicToken(token?: string | null): boolean {
  if (!token || typeof token !== 'string') return false;
  // URL-safe base64 string: 12 chars
  return /^[A-Za-z0-9_-]{12}$/.test(token);
}

/**
 * Fetch and project a public quotation by publicToken.
 */
export async function getPublicQuotationByToken(
  token: string
): Promise<PublicDocumentProjection | null> {
  if (!isValidPublicToken(token)) {
    return null;
  }

  await dbConnect();

  // Find quotation by publicToken only (§5.6)
  const quotation = await Quotation.findOne({
    publicToken: token,
  }).lean();

  if (!quotation) {
    return null;
  }

  // 1. Check if token was revoked (§5.6)
  if (quotation.publicTokenRevokedAt) {
    return null;
  }

  // 2. Check if owner has public links disabled for abuse (§5.9)
  const owner = await User.findById(quotation.userId, {
    publicLinksDisabledAt: 1,
    suspendedAt: 1,
  }).lean();

  if (!owner || owner.publicLinksDisabledAt) {
    return null;
  }

  // Use snapshots if frozen at SENT (§3.9), otherwise fetch current profiles
  let businessInfo: PublicBusiness = {
    businessName: quotation.businessSnapshot?.businessName || '',
    address: quotation.businessSnapshot?.address,
    email: quotation.businessSnapshot?.email,
    phone: quotation.businessSnapshot?.phone,
    logoUrl: quotation.businessSnapshot?.logoUrl,
  };

  if (!quotation.businessSnapshot) {
    const b = await Business.findOne({ userId: quotation.userId }).lean();
    if (b) {
      businessInfo = {
        businessName: b.businessName,
        address: b.address,
        email: b.email,
        phone: b.phone,
        logoUrl: b.logoUrl,
      };
    }
  }

  let customerInfo: PublicCustomer = {
    name: quotation.customerSnapshot?.name || 'Customer',
    email: quotation.customerSnapshot?.email,
    phone: quotation.customerSnapshot?.phone,
    address: quotation.customerSnapshot?.address,
  };

  if (!quotation.customerSnapshot) {
    const c = await Customer.findById(quotation.customerId).lean();
    if (c) {
      customerInfo = {
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
      };
    }
  }

  // Derive EXPIRED at read time (§5.4): status === 'SENT' && validUntil < today
  let displayStatus = quotation.status;
  if (displayStatus === 'SENT' && quotation.validUntil) {
    if (new Date(quotation.validUntil).getTime() < Date.now()) {
      displayStatus = 'EXPIRED';
    }
  }

  // Hand-written minimal projection (§5.6)
  return {
    kind: 'quotation',
    number: quotation.number,
    status: displayStatus,
    issueDate: new Date(quotation.issueDate).toISOString(),
    secondaryDateLabel: 'Valid Until',
    secondaryDate: new Date(quotation.validUntil).toISOString(),
    items: (quotation.items || []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCentavos: item.unitPriceCentavos,
      amountCentavos: item.amountCentavos,
    })),
    subtotalCentavos: quotation.subtotalCentavos,
    discountCentavos: quotation.discountCentavos,
    totalCentavos: quotation.totalCentavos,
    notes: quotation.notes,
    terms: quotation.terms,
    business: businessInfo,
    customer: customerInfo,
  };
}
