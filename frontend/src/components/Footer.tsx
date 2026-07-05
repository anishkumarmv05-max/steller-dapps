export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border-subtle)',
      padding: '32px 20px',
      marginTop: 40,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'linear-gradient(135deg, var(--cyan-600), var(--cyan-400))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>StellarVault</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>v1.0.0</span>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'GitHub', href: 'https://github.com/stellarvault' },
            { label: 'Docs', href: '#' },
            { label: 'Stellar Expert', href: 'https://stellar.expert/explorer/testnet' },
            { label: 'Testnet Faucet', href: 'https://laboratory.stellar.org/#account-creator' },
          ].map(link => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--text-muted)', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Built on <span style={{ color: 'var(--cyan-400)' }}>Stellar Soroban</span> · Orange Belt Submission
        </div>
      </div>
    </footer>
  );
}
