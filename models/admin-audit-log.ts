import mongoose, { Schema, Model } from 'mongoose';
import type { IAdminAuditLog } from '@/types';

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    action: {
      type: String,
      enum: [
        'USER_VIEW',
        'DOCUMENT_VIEW',
        'USER_SUSPEND',
        'USER_UNSUSPEND',
        'PLAN_OVERRIDE_SET',
        'PLAN_OVERRIDE_CLEAR',
        'PUBLIC_LINK_REVOKE',
        'PUBLIC_LINKS_DISABLE',
        'PUBLIC_LINKS_ENABLE',
        'MFA_RESET',
        'SUPPORT_LOOKUP',
        // Donation QR (AGENTS.md §4.9) — must stay in step with
        // lib/admin/audit.ts's AdminAuditAction union
        'DONATION_QR_SET',
        'DONATION_QR_CLEAR',
        'DONATION_TOGGLE',
      ],
      required: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetType: {
      type: String,
      default: null,
    },
    targetId: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: null,
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes per DEVELOPMENT_PLAN.md §6
AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ targetUserId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export const AdminAuditLog: Model<IAdminAuditLog> =
  mongoose.models.AdminAuditLog ||
  mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);

export default AdminAuditLog;
