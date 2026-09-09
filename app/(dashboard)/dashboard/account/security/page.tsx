import { redirect } from 'next/navigation';
import { requireUser, assertNotSuspended, AuthGuardError } from '@/lib/auth-guards';
import { getSecurityStatus } from '@/actions/account';
import { AccountSecuritySettings } from '@/components/dashboard/AccountSecuritySettings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account Security & Two-Factor Authentication · Bilyo',
  description: 'Manage your optional authenticator app, recovery codes, and device replacement.',
};

export default async function AccountSecurityPage() {
  try {
    const user = await requireUser();
    await assertNotSuspended(user.id);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.code === 'ACCOUNT_SUSPENDED') {
        redirect('/login?error=suspended');
      }
      redirect('/login');
    }
    throw error;
  }

  const res = await getSecurityStatus();
  if (!res.ok) {
    redirect('/dashboard/account');
  }

  return <AccountSecuritySettings initialStatus={res.data} />;
}
