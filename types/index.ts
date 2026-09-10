import type { Types } from 'mongoose';

// User & Auth Types
export type UserRole = 'USER' | 'ADMIN';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  emailVerifiedAt?: Date | null;
  emailVerificationSentAt?: Date | null;
  emailVerificationSends?: number;
  emailBouncedAt?: Date | null;

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
  lastSeenEventsAt?: Date | null;

  // Session Invalidation
  sessionsValidFrom?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

// Supported Currencies
export type CurrencyCode = 'PHP' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'SGD' | 'CAD';

// Business Profile
export interface IBusiness {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  logoUrl?: string | null;
  currency?: CurrencyCode;
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
}

export interface IBusinessSnapshot {
  businessName: string;
  address?: string;
  email?: string;
  phone?: string;
  logoUrl?: string | null;
  currency?: CurrencyCode;
}

export interface ILineItem {
  description: string;
  quantity: number;
  unitPriceCentavos: number;
  amountCentavos: number;
}

// Document Statuses (§6.4: stored statuses)
export type QuotationStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED';

// Read-time display status including derived EXPIRED (§6.4)
export type DerivedQuotationStatus = QuotationStatus | 'EXPIRED';

// Quotation
export interface IQuotation {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  customerId: Types.ObjectId;
  number: string;
  currency?: CurrencyCode;
  customerSnapshot?: ICustomerSnapshot;
  businessSnapshot?: IBusinessSnapshot;
  items: ILineItem[];
  subtotalCentavos: number;
  discountCentavos: number;
  totalCentavos: number;
  status: QuotationStatus;
  issueDate: Date;
  validUntil: Date;
  notes?: string;
  terms?: string;
  publicCode?: string | null;
  publicCodeRevokedAt?: Date | null;
  publicToken?: string | null;
  publicTokenRevokedAt?: Date | null;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  respondedAt?: Date | null;
  respondedByName?: string | null;
  responseIp?: string | null;
  paidAt?: Date | null;
  paidAmountCentavos?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Atomic Numbering Counter
export type CounterKind = 'QUOTATION';

export interface ICounter {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  kind: CounterKind;
  year: number;
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

// Quotation Event Types (§6.6)
export type EventType =
  | 'CREATED'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'MARKED_PAID'
  | 'UNMARKED_PAID'
  | 'LINK_REVOKED';

export type EventActor = 'OWNER' | 'CLIENT' | 'ADMIN' | 'SYSTEM';

// Quotation Event (Append-only, §6.6, §7)
export interface IEvent {
  _id: Types.ObjectId;
  quotationId: Types.ObjectId;
  userId: Types.ObjectId;
  type: EventType;
  actor: EventActor;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Email Message Outbox Ledger (EMAIL_DELIVERY_PLAN.md §3.1)
export type EmailMessageKind =
  | 'QUOTATION_SENT'
  | 'QUOTATION_RESPONDED'
  | 'PASSWORD_RESET'
  | 'ACCESS_EXPIRING'
  | 'EMAIL_VERIFICATION';

export type EmailMessageStatus =
  | 'SKIPPED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'DELAYED'
  | 'BOUNCED'
  | 'COMPLAINED'
  | 'FAILED'
  | 'SUPPRESSED';

export interface IEmailMessage {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  quotationId?: Types.ObjectId | null;
  kind: EmailMessageKind;
  toEmail: string;
  subject: string;
  providerId?: string | null;
  idempotencyKey: string;
  status: EmailMessageStatus;
  attempts: number;
  lastError?: string | null;
  queuedAt?: Date | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  bouncedAt?: Date | null;
  complainedAt?: Date | null;
  /** TTL marker — null means this row is kept indefinitely. See models/email-message.ts. */
  purgeAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook Receipt Deduplication (EMAIL_DELIVERY_PLAN.md §3, §5.4)
export interface IWebhookReceipt {
  _id: Types.ObjectId;
  svixId: string;
  receivedAt: Date;
  createdAt: Date;
}

// Verification Token (SIGNUP_VERIFICATION_PLAN.md §3.1)
export interface IVerificationToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  purpose: 'EMAIL_VERIFY';
  tokenHash: string;
  expiresAt: Date;
  codeHash: string;
  codeExpiresAt: Date;
  attempts: number;
  codeInvalidAt?: Date | null;
  usedAt?: Date | null;
  grantedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Rate Limiting
export interface IRateLimit {
  _id: Types.ObjectId;
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
}

