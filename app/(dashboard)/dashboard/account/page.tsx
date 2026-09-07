import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import { User } from '@/models/user';
import { requireUser, assertNotSuspended, AuthGuardError } from '@/lib/auth-guards';
import { sanitizeUserExport } from '@/lib/export';
import { AccountSettings } from '@/components/dashboard/AccountSettings';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account Settings · Bilyo',
  description: 'Manage password, email, data portability under PH Data Privacy Act, and account lifecycle.',
};

export default async function AccountPage() {
  let sessionUser;
  try {
    sessionUser = await requireUser();
    await assertNotSuspended(sessionUser.id);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.code === 'ACCOUNT_SUSPENDED') {
        redirect('/login?error=suspended');
      }
      redirect('/login');
    }
    throw error;
  }

  await dbConnect();
  const dbUser = await User.findById(sessionUser.id).lean();
  if (!dbUser) {
    redirect('/login');
  }

  const sanitizedUser = sanitizeUserExport(dbUser);

  return <AccountSettings user={sanitizedUser} />;
}
