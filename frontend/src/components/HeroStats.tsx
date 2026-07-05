'use client';

import { formatXLM, type VaultStats } from '@/lib/stellar';

interface HeroStatsProps {
  stats: VaultStats | null;
  loading: boolean;
}

const statCards = [
  {
    key: 'tvl',
    label: 'Total Value Locked',
    suffix: 'XLM',
    color: 'var(--cyan-400)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
        <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
      </svg>
    ),
  },
  {
    key: 'vaults',
    label: 'Active Vaults',
    suffix: '',
    color: 'var(--emerald-400)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'yield',
    label: 'Total Yield Paid',
    suffix: 'XLM',
    color: 'var(--gold-400)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    key: 'apy',
    label: 'Base APY',
    suffix: '%',
    color: 'var(--rose-400)',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
      </svg>
    ),
  },
];

export default function HeroStats({ stats, loading }: HeroStatsProps) {
  function getValue(key: string): string {
    if (loading || !stats) return '—';
    switch (key) {
      case 'tvl': return formatXLM(stats.totalDeposited);
      case 'vaults': return stats.totalVaults.toLocaleString();
      case 'yield': return formatXLM(stats.totalYieldPaid);
      case 'apy': return '5.00';
      default: return '—';
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 16,
    }}>
      {statCards.map(card => (
        <div key={card.key} className="glass border-animated" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {card.label}
            </span>
            <span style={{ color: card.color, opacity: 0.7 }}>{card.icon}</span>
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 32, width: '70%' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: card.color, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                {getValue(card.key)}
              </span>
              {card.suffix && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{card.suffix}</span>
              )}
            </div>
          )}

          {card.key === 'apy' && !loading && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gold-400)' }}>
              7.5% with lock boost ⚡
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
