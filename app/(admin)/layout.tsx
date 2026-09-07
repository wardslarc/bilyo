import { notFound } from 'next/navigation';
import { requireAdmin, AdminGuardError } from '@/lib/admin/guard';
import { AdminHeader } from '@/components/admin/AdminHeader';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Admin · Bilyo',
  description: 'Internal platform administration and audit console.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    // Non-admins, missing allowlist, or unverified MFA -> strict 404 (AGENTS.md §3.7, §4)
    if (error instanceof AdminGuardError) {
      notFound();
    }
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminHeader adminEmail={admin.email} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
