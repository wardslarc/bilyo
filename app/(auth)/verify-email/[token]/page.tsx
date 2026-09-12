import crypto from 'node:crypto';
import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import { User } from '@/models/user';
import { VerificationToken } from '@/models/verification-token';
import { notifyAdminOfSignup } from '@/lib/email/admin-alerts';

export const metadata: Metadata = {
  title: 'Verifying Email | Bilyo',
  description: 'Email verification magic link processing',
};

interface VerifyEmailTokenPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function VerifyEmailTokenPage({ params }: VerifyEmailTokenPageProps) {
  const { token } = await params;

  if (!token || typeof token !== 'string' || token.length !== 64) {
    return (
      <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3 text-red-600 font-semibold text-lg">
          ✕
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Invalid Verification Link
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
          The link you clicked appears to be incomplete or malformed.
        </p>
        <div className="mt-6">
          <Link
            href="/verify-email"
            className="inline-block py-2.5 px-4 rounded-lg bg-[var(--color-ink)] text-white text-sm font-medium hover:bg-[var(--color-ink-raised)] transition-colors"
          >
            Enter 6-digit code instead
          </Link>
        </div>
      </div>
    );
  }

  await dbConnect();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenDoc = await VerificationToken.findOne({ tokenHash });

  // 1. Not found
  if (!tokenDoc) {
    return (
      <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3 text-red-600 font-semibold text-lg">
          ✕
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Link Not Found
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
          This verification link was not found or has already expired.
        </p>
        <div className="mt-6">
          <Link
            href="/verify-email"
            className="inline-block py-2.5 px-4 rounded-lg bg-[var(--color-ink)] text-white text-sm font-medium hover:bg-[var(--color-ink-raised)] transition-colors"
          >
            Request a new code
          </Link>
        </div>
      </div>
    );
  }

  // 2. Already used (idempotent §4.5)
  if (tokenDoc.usedAt) {
    return (
      <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3 text-emerald-600 font-semibold text-lg">
          ✓
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Email Already Verified
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
          Your email address has already been verified. You can sign in to your account.
        </p>
        <div className="mt-6">
          <Link
            href="/login?verified=1"
            className="inline-block py-2.5 px-4 rounded-lg bg-[var(--color-ink)] text-white text-sm font-medium hover:bg-[var(--color-ink-raised)] transition-colors"
          >
            Sign in now &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // 3. Expired link (> 24 hours)
  if (tokenDoc.expiresAt < new Date()) {
    return (
      <div className="bg-white border border-[var(--color-line)] rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3 text-amber-700 font-semibold text-lg">
          !
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Verification Link Expired
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">
          Verification links are valid for 24 hours. Please request a new verification email.
        </p>
        <div className="mt-6">
          <Link
            href="/verify-email"
            className="inline-block py-2.5 px-4 rounded-lg bg-[var(--color-ink)] text-white text-sm font-medium hover:bg-[var(--color-ink-raised)] transition-colors"
          >
            Request new email
          </Link>
        </div>
      </div>
    );
  }

  // 4. Valid and unexpired: consume token and mark user verified
  const verifiedAt = new Date();

  if (process.env.TRIAL_ENABLED === 'true') {
    const trialDays = Number.parseInt(process.env.TRIAL_DAYS || '14', 10);
    const safeTrialDays = Number.isFinite(trialDays) && trialDays > 0 ? trialDays : 14;
    const accessUntilDate = new Date(verifiedAt.getTime() + safeTrialDays * 86400000);

    // Only assign trial if user does not already have an accessUntil set
    await User.updateOne(
      { _id: tokenDoc.userId, accessUntil: null },
      { $set: { emailVerifiedAt: verifiedAt, accessUntil: accessUntilDate } }
    );
  }

  await User.updateOne(
    { _id: tokenDoc.userId },
    { $set: { emailVerifiedAt: verifiedAt } }
  );

  await VerificationToken.updateOne(
    { _id: tokenDoc._id },
    { $set: { usedAt: verifiedAt } }
  );

  // Operator alert (§12 P6-T06). Must run before redirect(), which throws to
  // unwind. Idempotent per {user, recipient}, so the code-entry path landing
  // here too cannot double-send. Never throws.
  await notifyAdminOfSignup(tokenDoc.userId.toString(), { verifiedAt });

  // Link clicked in browser redirects to login with verified banner (§4.5)
  redirect('/login?verified=1');
}
