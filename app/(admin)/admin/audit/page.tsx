import { requireAdmin } from '@/lib/admin/guard';
import { getAdminAuditLogs } from '@/lib/admin/audit';
import { AdminAuditLogViewer } from '@/components/admin/AdminAuditLogViewer';
import type { AdminAuditAction } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Audit Log · Bilyo Admin',
  description: 'Inspect immutable administrative action history, security changes, and operational logs.',
};

interface AdminAuditPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  // Enforce admin surface guard (§5.8)
  await requireAdmin();

  const resolvedParams = await searchParams;

  const page = Math.max(1, Number(resolvedParams.page) || 1);
  const actor = typeof resolvedParams.actor === 'string' ? resolvedParams.actor : '';
  const targetUser = typeof resolvedParams.target === 'string' ? resolvedParams.target : '';
  const action = (typeof resolvedParams.action === 'string'
    ? resolvedParams.action
    : 'ALL') as AdminAuditAction | 'ALL';

  const data = await getAdminAuditLogs({
    page,
    limit: 25,
    actor,
    targetUser,
    action,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Audit Log
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review an append-only, immutable history of administrative actions, support lookups, and account moderation events.
        </p>
      </div>

      <AdminAuditLogViewer
        logs={data.logs}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
        limit={data.limit}
        currentActor={actor}
        currentTarget={targetUser}
        currentAction={action}
      />
    </div>
  );
}
