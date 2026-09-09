import { getAdminUsersList } from '@/lib/admin/users';
import { AdminUserList } from '@/components/admin/AdminUserList';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'User Management · Bilyo Admin',
  description: 'Manage users, suspension status, and document counts.',
};

interface AdminUsersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const resolvedParams = await searchParams;

  const page = Math.max(1, Number(resolvedParams.page) || 1);
  const search = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';
  const status = (typeof resolvedParams.status === 'string'
    ? resolvedParams.status
    : 'ALL') as 'ACTIVE' | 'SUSPENDED' | 'DELETION' | 'ALL';
  const activeIn30Days = resolvedParams.active30 === '1';

  const data = await getAdminUsersList({
    page,
    limit: 25,
    search,
    status,
    activeIn30Days,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          User Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review accounts, track activity, and resolve support cases.
        </p>
      </div>

      <AdminUserList
        users={data.users}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
        limit={data.limit}
        currentSearch={search}
        currentStatus={status}
        currentActive30={activeIn30Days}
      />
    </div>
  );
}
