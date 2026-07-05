'use client';

import { useState, useEffect } from 'react';
import { formatAddress } from '@/lib/stellar';

interface Activity {
  id: number;
  type: 'deposit' | 'withdraw' | 'yield' | 'lock';
  address: string;
  amount: string;
  time: string;
}

const TYPES = {
  deposit: { label: 'Deposit', color: 'var(--cyan-400)', icon: '↓' },
  withdraw: { label: 'Withdraw', color: 'var(--rose-400)', icon: '↑' },
  yield: { label: 'Yield', color: 'var(--emerald-400)', icon: '✦' },
  lock: { label: 'Lock', color: 'var(--gold-400)', icon: '⚡' },
};

function randomAddress() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let addr = 'G';
  for (let i = 0; i < 55; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return addr;
}

function randomActivity(id: number): Activity {
  const types: Activity['type'][] = ['deposit', 'withdraw', 'yield', 'lock'];
  const type = types[Math.floor(Math.random() * types.length)];
  const amount = (Math.random() * 5000 + 10).toFixed(2);
  return {
    id,
    type,
    address: randomAddress(),
    amount,
    time: 'just now',
  };
}

const INITIAL: Activity[] = Array.from({ length: 6 }, (_, i) => ({
  ...randomActivity(i),
  time: `${(i + 1) * 2}m ago`,
}));

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>(INITIAL);

  useEffect(() => {
    let counter = 100;
    const interval = setInterval(() => {
      setActivities(prev => [randomActivity(counter++), ...prev.slice(0, 8)]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Live Activity</h3>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--emerald-400)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} className="animate-pulse-cyan" />
          Real-time
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {activities.slice(0, 7).map((act, idx) => {
          const meta = TYPES[act.type];
          return (
            <div
              key={act.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: idx === 0 ? 'rgba(34,211,238,0.04)' : 'transparent',
                transition: 'background 0.3s',
              }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: '50%',
                background: `${meta.color}15`,
                color: meta.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>
                {meta.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  <span style={{ color: meta.color }}>{meta.label}</span>&nbsp;
                  <code className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatAddress(act.address)}</code>
                </div>
                <div className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {act.amount} XLM
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{act.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
