import type { Types } from 'mongoose';

// User & Auth Types
export type UserRole = 'USER' | 'ADMIN';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  emailVerifiedAt?: Date | null;

  // MFA (§5.11)
  mfaEnabledAt?: Date | null;
  mfaSecretEncrypted?: string | null;
  mfaPendingSecretEncrypted?: string | null;
  mfaPendingExpiresAt?: Date | null;
  mfaLastUsedStep?: number | null;
  mfaRecoveryCodeHashes: string[];
  mfaFailedAttempts: number;
  mfaLockedUntil?: Date | null;

  // Admin (§5.8, §5.9)
  role: UserRole;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  suspendedByUserId?: string | null;
  publicLinksDisabledAt?: Date | null;
  deletionRequestedAt?: Date | null;

  // Support Signals
  lastLoginAt?: Date | null;
  lastActiveAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

// Business Profile
export interface IBusiness {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  tin?: string;
  vatRegistered: boolean;
  logoUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Customer
export interface ICustomer {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tin?: string;
  notes?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Snapshots & Document Line Items
export interface ICustomerSnapshot {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tin?: string;
}

export interface IBusinessSnapshot {
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  tin?: string;
  vatRegistered: boolean;
  logoUrl?: string | null;
}

export interface ILineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

// Document Statuses
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

// Quotation
export interface IQuotation {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  customerId: Types.ObjectId;
  number: string;
  customerSnapshot?: ICustomerSnapshot;
  businessSnapshot?: IBusinessSnapshot;
  items: ILineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  vatRatePercent: number;
  vatCentavos: number;
  totalCentavos: number;
  status: QuotationStatus;
  issueDate: Date;
  validUntil: Date;
  notes?: string;
  terms?: string;
  publicToken?: string | null;
  publicTokenRevokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Atomic Numbering Counter
export type CounterKind = 'QUOTATION';

export interface ICounter {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: CounterKind;
  seq: number;
}

// Password Reset Token
export interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
}

// Admin Audit Log Action
export type AdminAuditAction =
  | 'USER_VIEW'
  | 'DOCUMENT_VIEW'
  | 'USER_SUSPEND'
  | 'USER_UNSUSPEND'
  | 'PLAN_OVERRIDE_SET'
  | 'PLAN_OVERRIDE_CLEAR'
  | 'PUBLIC_LINK_REVOKE'
  | 'PUBLIC_LINKS_DISABLE'
  | 'PUBLIC_LINKS_ENABLE'
  | 'MFA_RESET'
  | 'SUPPORT_LOOKUP';

// Admin Audit Log (Append-only)
export interface IAdminAuditLog {
  _id: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorEmail: string;
  action: AdminAuditAction;
  targetUserId?: Types.ObjectId | null;
  targetType?: string | null;
  targetId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

// Standard Server Action Result (AGENTS.md §5)
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
