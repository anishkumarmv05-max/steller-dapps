'use client';

import { useState } from 'react';
import { formatAddress } from '@/lib/stellar';

interface HeaderProps {
  wallet: {
    isConnected: boolean;
    publicKey: string | null;
    isLoading: boolean;
    connect: () => void;
    disconnect: () => void;
  };
}

export default function Header({ wallet }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(8, 11, 20, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 20px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, var(--cyan-600), var(--cyan-400))',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px var(--cyan-glow)',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
            Stellar<span style={{ color: 'var(--cyan-400)' }}>Vault</span>
          </span>
        </div>

        {/* Nav — desktop */}
        <nav className="hide-mobile" style={{ display: 'flex', gap: 32 }}>
          {['Vault', 'Analytics', 'Docs'].map(item => (
            <a key={item} href="#" style={{ fontSize: 14, color: 'var(--text-secondary)', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
              {item}
            </a>
          ))}
        </nav>

        {/* Wallet button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="badge badge-testnet hide-mobile">Testnet</div>

          {wallet.isConnected && wallet.publicKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald-400)', display: 'inline-block' }} />
                <span className="font-mono">{formatAddress(wallet.publicKey)}</span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: 13 }} onClick={wallet.disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: 13 }}
              onClick={wallet.connect}
              disabled={wallet.isLoading}
            >
              {wallet.isLoading ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin-slow 0.8s linear infinite' }} />
                  Connecting…
                </>
              ) : 'Connect Wallet'}
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            className="show-mobile"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="show-mobile" style={{
          background: 'var(--bg-deep)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {['Vault', 'Analytics', 'Docs'].map(item => (
            <a key={item} href="#" style={{ fontSize: 15, color: 'var(--text-secondary)' }} onClick={() => setMenuOpen(false)}>
              {item}
            </a>
          ))}
          <div className="badge badge-testnet" style={{ alignSelf: 'flex-start' }}>Testnet</div>
        </div>
      )}
    </header>
  );
}
