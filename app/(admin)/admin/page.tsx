import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/guard';
import { getPlatformMetrics } from '@/lib/admin/metrics';
import { PlatformMetricsTiles } from '@/components/admin/PlatformMetricsTiles';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Platform Overview & Metrics · Bilyo Admin',
  description: 'High-level platform KPIs, user growth, active document metrics, and administrative shortcuts.',
};

export default async function AdminHomePage() {
  await requireAdmin();
  const metrics = await getPlatformMetrics();

  const tools = [
    {
      title: 'User Management',
      href: '/admin/users',
      description:
        'Browse all platform accounts, search by email or business name, view active plans, and manage suspensions.',
      badge: 'M7-T02',
      icon: '👥',
    },
    {
      title: 'Document Lookup',
      href: '/admin/lookup',
      description:
        'Quickly locate any invoice or quotation by document number or public token to resolve customer support tickets.',
      badge: 'M7-T04',
      icon: '🔍',
    },
    {
      title: 'Audit Log',
      href: '/admin/audit',
      description:
        'Inspect immutable, append-only logs of all platform staff actions and user document access history.',
      badge: 'M7-T01',
      icon: '🛡️',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
          <span>Internal Dashboard</span>
          <span>•</span>
          <span>Operations & Analytics</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Platform Overview
          </h1>
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
            Staff Only
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Real-time KPIs for user acquisition, document production, revenue, and platform health.
        </p>
      </div>

      {/* KPI Tiles (M7-T07) */}
      <PlatformMetricsTiles metrics={metrics} />

      {/* Operational Shortcuts */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Operational Support Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="p-6 bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md rounded-xl transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{tool.icon}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {tool.badge}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {tool.description}
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                <span>Open Tool</span>
                <span className="ml-1">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
