'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import HeroStats from '@/components/HeroStats';
import VaultPanel from '@/components/VaultPanel';
import ActivityFeed from '@/components/ActivityFeed';
import YieldChart from '@/components/YieldChart';
import Footer from '@/components/Footer';
import { useWallet } from '@/hooks/useWallet';
import { getVaultStats, type VaultStats } from '@/lib/stellar';

export default function HomePage() {
  const wallet = useWallet();
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    const data = await getVaultStats();
    setStats(data);
    setLoadingStats(false);
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <Header wallet={wallet} />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 80px' }}>
        {/* Hero */}
        <section style={{ paddingTop: 80, paddingBottom: 60, textAlign: 'center' }}>
          <div className="badge badge-testnet" style={{ marginBottom: 24, display: 'inline-flex' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan-400)', display: 'inline-block' }} className="animate-pulse-cyan" />
            Live on Stellar Testnet
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 700, marginBottom: 20, letterSpacing: '-0.02em' }}>
            <span className="gradient-text">Earn Yield</span> on
            <br />
            Stellar Blockchain
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Deposit XLM into smart vaults, earn 5% APY, and lock positions for
            up to <strong style={{ color: 'var(--gold-400)' }}>7.5% boosted yield</strong>. Fully on-chain.
          </p>

          {!wallet.isConnected && (
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={wallet.connect}>
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
              Connect Freighter Wallet
            </button>
          )}
        </section>

        {/* Protocol Stats */}
        <HeroStats stats={stats} loading={loadingStats} />

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,380px)', gap: 24, marginTop: 32, alignItems: 'start' }}>
          {/* Left: Vault panel */}
          <div>
            <VaultPanel wallet={wallet} onStatsRefresh={fetchStats} />
          </div>

          {/* Right: Chart + Activity */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <YieldChart />
            <ActivityFeed />
          </div>
        </div>

        {/* Contract Info */}
        <section style={{ marginTop: 48 }}>
          <div className="glass" style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
              Deployed Contracts · Testnet
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'StellarVault', addr: 'CCIMKAWGJKAFMHH62NWFQJVXDETZFQONYHKW7WGODT6FQLULUSZDZLDQ' },
                { label: 'PriceOracle', addr: 'CBDJT4YBL5C7GSHB7TEKKS3C6WAX5SWT4652H4R7A4MYL75S6LQ7YRPS' },
                { label: 'Test Token', addr: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC' },
              ].map(({ label, addr }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 100 }}>{label}</span>
                  <code className="font-mono" style={{ fontSize: 12, color: 'var(--cyan-400)', flex: 1, wordBreak: 'break-all' }}>
                    {addr}
                  </code>
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${addr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border-default)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}
                  >
                    Explorer ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
