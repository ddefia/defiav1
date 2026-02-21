import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../services/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandOverview {
    brandId: string;
    brandName: string;
    ownerId: string;
    ownerEmail: string | null;
    createdAt: string;
    subscription: {
        status: string;
        planTier: string;
        periodEnd: string | null;
        stripeSubId: string | null;
    };
    trial: {
        endsAt: number | null;
        hoursLeft: number | null;
        isExpired: boolean;
    };
    usage: {
        contentThisMonth: number;
        imagesThisMonth: number;
    };
}

interface UsageSummary {
    totalCost: number;
    totalCalls: number;
    avgCostPerDay: number;
    from: string;
    to: string;
}

interface DailyUsage {
    date: string;
    totalCost: number;
    callCount: number;
}

interface ModelUsage {
    model: string;
    totalCost: number;
    callCount: number;
    totalTokensIn: number;
    totalTokensOut: number;
}

interface ProviderUsage {
    provider: string;
    totalCost: number;
    callCount: number;
}

interface BillingData {
    mrr: number;
    totalActive: number;
    totalTrialing: number;
    totalCanceled: number;
    totalPastDue: number;
    conversionRate: number;
    byTier: { starter: number; growth: number; enterprise: number };
    subscriptions: any[];
}

type AdminTab = 'overview' | 'api-usage' | 'billing';

interface AdminDashboardProps {
    onNavigate: (section: string, params?: any) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [overview, setOverview] = useState<{ users: BrandOverview[]; total: number } | null>(null);
    const [usage, setUsage] = useState<{ summary: UsageSummary; daily: DailyUsage[]; byProvider: ProviderUsage[]; byModel: ModelUsage[] } | null>(null);
    const [billing, setBilling] = useState<BillingData | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            setError(null);
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
                const token = await getAuthToken();
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const [ovRes, usRes, biRes] = await Promise.all([
                    fetch(`${baseUrl}/api/admin/overview`, { headers }),
                    fetch(`${baseUrl}/api/admin/api-usage`, { headers }),
                    fetch(`${baseUrl}/api/admin/billing`, { headers }),
                ]);

                if (ovRes.status === 403) {
                    setError('Access denied. You are not an admin.');
                    setLoading(false);
                    return;
                }

                const [ovData, usData, biData] = await Promise.all([
                    ovRes.ok ? ovRes.json() : null,
                    usRes.ok ? usRes.json() : null,
                    biRes.ok ? biRes.json() : null,
                ]);

                setOverview(ovData);
                setUsage(usData);
                setBilling(biData);
            } catch (e: any) {
                setError(e.message || 'Failed to load admin data');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const tabs: { id: AdminTab; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overview', icon: 'groups' },
        { id: 'api-usage', label: 'API Usage', icon: 'monitoring' },
        { id: 'billing', label: 'Billing', icon: 'payments' },
    ];

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-10">
                <div className="text-center">
                    <span className="material-symbols-sharp text-4xl mb-4 block" style={{ color: '#EF4444' }}>shield</span>
                    <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF5C00, #FF8400)' }}>
                        <span className="material-symbols-sharp text-white text-xl" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>admin_panel_settings</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Internal platform monitoring</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-8 flex gap-1 flex-shrink-0">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                            backgroundColor: activeTab === tab.id ? '#FF5C00' : 'transparent',
                            color: activeTab === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                        }}
                    >
                        <span className="material-symbols-sharp text-base" style={{ fontVariationSettings: "'wght' 300" }}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-8 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-[#FF5C00] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && overview && <OverviewTab data={overview} />}
                        {activeTab === 'api-usage' && usage && <ApiUsageTab data={usage} />}
                        {activeTab === 'billing' && billing && <BillingTab data={billing} />}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Overview Tab ───────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ data: { users: BrandOverview[]; total: number } }> = ({ data }) => (
    <div className="flex flex-col gap-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
            <StatCard icon="groups" label="Total Brands" value={data.total} />
            <StatCard icon="hourglass_top" label="Active Trials" value={data.users.filter(u => !u.trial.isExpired && u.trial.endsAt).length} color="#22C55E" />
            <StatCard icon="timer_off" label="Expired Trials" value={data.users.filter(u => u.trial.isExpired).length} color="#EF4444" />
            <StatCard icon="credit_card" label="Paid Users" value={data.users.filter(u => u.subscription.stripeSubId).length} color="#3B82F6" />
        </div>

        {/* Brands Table */}
        <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <Th>Brand</Th>
                        <Th>Owner</Th>
                        <Th>Plan</Th>
                        <Th>Status</Th>
                        <Th>Trial</Th>
                        <Th>Usage</Th>
                        <Th>Created</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.users.map(user => (
                        <tr key={user.brandId} style={{ borderBottom: '1px solid var(--border)' }}>
                            <Td><span className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.brandName}</span></Td>
                            <Td>{user.ownerEmail || <span style={{ color: 'var(--text-faint)' }}>—</span>}</Td>
                            <Td><span className="capitalize">{user.subscription.planTier}</span></Td>
                            <Td><StatusBadge status={user.subscription.status} /></Td>
                            <Td>
                                {user.trial.isExpired ? (
                                    <span className="text-xs text-red-400">Expired</span>
                                ) : user.trial.hoursLeft !== null ? (
                                    <span className="text-xs text-green-400">{user.trial.hoursLeft}h left</span>
                                ) : (
                                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                                )}
                            </Td>
                            <Td>
                                <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                    {user.usage.contentThisMonth}c / {user.usage.imagesThisMonth}i
                                </span>
                            </Td>
                            <Td>
                                <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </span>
                            </Td>
                        </tr>
                    ))}
                    {data.users.length === 0 && (
                        <tr><Td colSpan={7}><span style={{ color: 'var(--text-muted)' }}>No brands registered yet.</span></Td></tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// ─── API Usage Tab ──────────────────────────────────────────────────────────

const ApiUsageTab: React.FC<{ data: { summary: UsageSummary; daily: DailyUsage[]; byProvider: ProviderUsage[]; byModel: ModelUsage[] } }> = ({ data }) => {
    const maxDailyCost = Math.max(...data.daily.map(d => d.totalCost), 0.001);

    return (
        <div className="flex flex-col gap-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <StatCard icon="attach_money" label="Total Cost (30d)" value={`$${data.summary.totalCost.toFixed(2)}`} />
                <StatCard icon="api" label="Total API Calls" value={data.summary.totalCalls.toLocaleString()} />
                <StatCard icon="trending_up" label="Avg Cost / Day" value={`$${data.summary.avgCostPerDay.toFixed(4)}`} />
            </div>

            {/* Daily Cost Bar Chart */}
            <div className="rounded-[14px] p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Daily API Cost</h3>
                {data.daily.length > 0 ? (
                    <div className="flex items-end gap-1" style={{ height: 120 }}>
                        {data.daily.map(day => {
                            const pct = Math.max(2, (day.totalCost / maxDailyCost) * 100);
                            return (
                                <div key={day.date} className="flex-1 flex flex-col items-center gap-1" title={`${day.date}: $${day.totalCost.toFixed(4)} (${day.callCount} calls)`}>
                                    <div
                                        className="w-full rounded-t"
                                        style={{
                                            height: `${pct}%`,
                                            backgroundColor: '#FF5C00',
                                            opacity: 0.8,
                                            minWidth: 4,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No usage data yet. Costs will appear here once API calls are logged.</p>
                )}
                {data.daily.length > 0 && (
                    <div className="flex justify-between mt-2">
                        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{data.daily[0]?.date}</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{data.daily[data.daily.length - 1]?.date}</span>
                    </div>
                )}
            </div>

            {/* Provider + Model Breakdown */}
            <div className="grid grid-cols-2 gap-4">
                {/* By Provider */}
                <div className="rounded-[14px] p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>By Provider</h3>
                    <div className="flex flex-col gap-2">
                        {data.byProvider.length > 0 ? data.byProvider.map(p => (
                            <div key={p.provider} className="flex items-center justify-between">
                                <span className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{p.provider}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{p.callCount} calls</span>
                                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>${p.totalCost.toFixed(4)}</span>
                                </div>
                            </div>
                        )) : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No data yet</p>}
                    </div>
                </div>

                {/* By Model */}
                <div className="rounded-[14px] p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>By Model</h3>
                    <div className="flex flex-col gap-2">
                        {data.byModel.length > 0 ? data.byModel.map(m => (
                            <div key={m.model} className="flex items-center justify-between">
                                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{m.model}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{m.callCount} calls</span>
                                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>${m.totalCost.toFixed(4)}</span>
                                </div>
                            </div>
                        )) : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No data yet</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Billing Tab ────────────────────────────────────────────────────────────

const BillingTab: React.FC<{ data: BillingData }> = ({ data }) => (
    <div className="flex flex-col gap-6">
        {/* Revenue Cards */}
        <div className="grid grid-cols-4 gap-4">
            <StatCard icon="payments" label="MRR" value={`$${data.mrr.toLocaleString()}`} color="#22C55E" />
            <StatCard icon="check_circle" label="Active" value={data.totalActive} color="#22C55E" />
            <StatCard icon="hourglass_top" label="Trialing" value={data.totalTrialing} color="#F59E0B" />
            <StatCard icon="percent" label="Conversion" value={`${data.conversionRate}%`} />
        </div>

        {/* Tier Breakdown */}
        <div className="rounded-[14px] p-6" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Plan Distribution</h3>
            <div className="flex gap-6">
                {(['starter', 'growth', 'enterprise'] as const).map(tier => (
                    <div key={tier} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <span className="text-sm font-bold" style={{ color: '#FF5C00' }}>{data.byTier[tier]}</span>
                        </div>
                        <span className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{tier}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Subscriptions Table */}
        {data.subscriptions.length > 0 && (
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <Th>User ID</Th>
                            <Th>Plan</Th>
                            <Th>Status</Th>
                            <Th>Period End</Th>
                            <Th>Stripe Sub</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.subscriptions.map((sub: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                <Td><span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{sub.user_id?.slice(0, 8)}...</span></Td>
                                <Td><span className="capitalize">{sub.plan_tier}</span></Td>
                                <Td><StatusBadge status={sub.status} /></Td>
                                <Td>
                                    {sub.current_period_end
                                        ? <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{new Date(sub.current_period_end).toLocaleDateString()}</span>
                                        : <span style={{ color: 'var(--text-faint)' }}>—</span>
                                    }
                                </Td>
                                <Td><span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>{sub.id?.slice(0, 16)}...</span></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// ─── Shared Components ──────────────────────────────────────────────────────

const StatCard: React.FC<{ icon: string; label: string; value: string | number; color?: string }> = ({ icon, label, value, color }) => (
    <div className="rounded-[14px] p-5" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-sharp text-base" style={{ color: color || '#FF5C00', fontVariationSettings: "'FILL' 1, 'wght' 300" }}>{icon}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, { bg: string; text: string }> = {
        active:   { bg: 'rgba(34, 197, 94, 0.1)', text: '#22C55E' },
        trialing: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' },
        expired:  { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444' },
        canceled: { bg: 'rgba(107, 107, 112, 0.1)', text: '#6B6B70' },
        past_due: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444' },
        none:     { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6' },
    };
    const c = colors[status] || colors.none;
    return (
        <span
            className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize"
            style={{ backgroundColor: c.bg, color: c.text }}
        >
            {status}
        </span>
    );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {children}
    </th>
);

const Td: React.FC<{ children: React.ReactNode; colSpan?: number }> = ({ children, colSpan }) => (
    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }} colSpan={colSpan}>
        {children}
    </td>
);
