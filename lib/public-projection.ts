import dbConnect from './mongodb.ts';
import { Quotation } from '../models/quotation.ts';
import { User } from '../models/user.ts';
import { Business } from '../models/business.ts';
import { Customer } from '../models/customer.ts';
import { type DocumentStatus, getDerivedQuotationStatus } from './documents.ts';

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
  respondedAt?: string | null;
  respondedByName?: string | null;
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
 * Validates a public code format (must be 12-char URL-safe base64 string, §6.7).
 */
export function isValidPublicCode(code?: string | null): boolean {
  if (!code || typeof code !== 'string') return false;
  // URL-safe base64 string: 12 chars
  return /^[A-Za-z0-9_-]{12}$/.test(code);
}

/**
 * Backward compatibility alias for isValidPublicCode.
 */
export const isValidPublicToken = isValidPublicCode;

/**
 * Fetch and project a public quotation by publicCode (or legacy publicToken).
 */
export async function getPublicQuotationByCode(
  code: string
): Promise<PublicDocumentProjection | null> {
  if (!isValidPublicCode(code)) {
    return null;
  }

  await dbConnect();

  // Find quotation by publicCode (or fallback to legacy publicToken) (§6.7)
  const quotation = await Quotation.findOne({
    $or: [{ publicCode: code }, { publicToken: code }],
  }).lean();

  if (!quotation) {
    return null;
  }

  // 1. Check if code was revoked (§6.7)
  if (quotation.publicCodeRevokedAt || quotation.publicTokenRevokedAt) {
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

  // Derive EXPIRED at read time (§6.4): status ∈ {SENT, VIEWED} && validUntil < today
  const displayStatus = getDerivedQuotationStatus(quotation.status, quotation.validUntil);

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
    respondedAt: quotation.respondedAt ? new Date(quotation.respondedAt).toISOString() : null,
    respondedByName: quotation.respondedByName || null,
    notes: quotation.notes,
    terms: quotation.terms,
    business: businessInfo,
    customer: customerInfo,
  };
}

/**
 * Backward compatibility alias for getPublicQuotationByCode.
 */
export const getPublicQuotationByToken = getPublicQuotationByCode;
