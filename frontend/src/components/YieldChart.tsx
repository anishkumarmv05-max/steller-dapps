'use client';

import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

function generateData(days: number) {
  const data = [];
  let tvl = 38_000;
  for (let i = days; i >= 0; i--) {
    tvl += (Math.random() - 0.3) * 2000;
    tvl = Math.max(20_000, Math.min(60_000, tvl));
    data.push({
      date: format(subDays(new Date(), i), 'MMM dd'),
      tvl: Math.round(tvl),
      yield: Math.round(tvl * 0.05 / 365),
    });
  }
  return data;
}

const PERIODS = ['7D', '30D', '90D'] as const;
type Period = typeof PERIODS[number];

const DAYS: Record<Period, number> = { '7D': 7, '30D': 30, '90D': 90 };

export default function YieldChart() {
  const [period, setPeriod] = useState<Period>('30D');
  const data = generateData(DAYS[period]);

  return (
    <div className="glass" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Protocol TVL</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Historical value locked</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: period === p ? '1px solid var(--cyan-500)' : '1px solid var(--border-default)',
                background: period === p ? 'rgba(6,182,212,0.1)' : 'transparent',
                color: period === p ? 'var(--cyan-400)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--cyan-500)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--cyan-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.floor(data.length / 4)} />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            formatter={(v: number) => [`${v.toLocaleString()} XLM`, 'TVL']}
            labelStyle={{ color: 'var(--text-muted)' }}
          />
          <Area
            type="monotone"
            dataKey="tvl"
            stroke="var(--cyan-500)"
            strokeWidth={2}
            fill="url(#tvlGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
