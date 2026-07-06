import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { signTransaction } from '@stellar/freighter-api';
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { formatXLM, formatAddress, getVault, getPendingYield, CONTRACT_ADDRESSES, buildContractTransaction, submitTransaction, NETWORK_PASSPHRASE, type VaultData } from '@/lib/stellar';

type Tab = 'deposit' | 'withdraw' | 'claim' | 'lock';

interface VaultPanelProps {
  wallet: {
    isConnected: boolean;
    publicKey: string | null;
    connect: () => void;
    refreshBalance: () => Promise<void>;
  };
  onStatsRefresh: () => void;
}

export default function VaultPanel({ wallet, onStatsRefresh }: VaultPanelProps) {
  const [tab, setTab] = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');
  const [lockAmount, setLockAmount] = useState('');
  const [lockDays, setLockDays] = useState('7');
  const [loading, setLoading] = useState(false);
  const [vaultData, setVaultData] = useState<VaultData | null>(null);
  const [pendingYield, setPendingYield] = useState<bigint>(BigInt(0));
  const [loadingVault, setLoadingVault] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (wallet.isConnected && wallet.publicKey) {
      loadVaultData(wallet.publicKey);
      const interval = setInterval(() => loadVaultData(wallet.publicKey!), 15_000);
      return () => clearInterval(interval);
    }
  }, [wallet.isConnected, wallet.publicKey]);

  async function loadVaultData(pk: string) {
    setLoadingVault(true);
    const [vault, yieldAmt] = await Promise.all([
      getVault(pk),
      getPendingYield(pk),
    ]);
    setVaultData(vault);
    setPendingYield(yieldAmt);
    setLoadingVault(false);
  }

  async function handleAction() {
    if (!wallet.publicKey) return;
    setLoading(true);

    try {
      let xdrString = '';
      const ownerScVal = nativeToScVal(Address.fromString(wallet.publicKey), { type: 'address' });
      const tokenScVal = nativeToScVal(Address.fromString(CONTRACT_ADDRESSES.TOKEN), { type: 'address' });

      if (tab === 'deposit') {
        const amountStroops = BigInt(Math.floor(Number(amount) * 10_000_000));
        const amountScVal = nativeToScVal(amountStroops, { type: 'i128' });
        xdrString = await buildContractTransaction(wallet.publicKey, 'deposit', [ownerScVal, tokenScVal, amountScVal]);
      } else if (tab === 'withdraw') {
        const amountStroops = BigInt(Math.floor(Number(amount) * 10_000_000));
        const amountScVal = nativeToScVal(amountStroops, { type: 'i128' });
        xdrString = await buildContractTransaction(wallet.publicKey, 'withdraw', [ownerScVal, amountScVal]);
      } else if (tab === 'claim') {
        xdrString = await buildContractTransaction(wallet.publicKey, 'claim_yield', [ownerScVal]);
      } else if (tab === 'lock') {
        const lockAmountStroops = BigInt(Math.floor(Number(lockAmount) * 10_000_000));
        const lockAmountScVal = nativeToScVal(lockAmountStroops, { type: 'i128' });
        const lockSecs = BigInt(Number(lockDays) * 86_400);
        const lockScVal = nativeToScVal(lockSecs, { type: 'u64' });
        xdrString = await buildContractTransaction(wallet.publicKey, 'lock_vault', [ownerScVal, lockAmountScVal, lockScVal]);
      }

      const signedXdr = await signTransaction(xdrString, { networkPassphrase: NETWORK_PASSPHRASE });
      if (!signedXdr) throw new Error("User rejected transaction");
      
      const txHash = await submitTransaction(signedXdr);
      setLastTxHash(txHash);

      switch (tab) {
        case 'deposit': toast.success(`Deposited ${amount} XLM into vault`, { icon: '✅' }); break;
        case 'withdraw': toast.success(`Withdrew ${amount} XLM from vault`, { icon: '💸' }); break;
        case 'claim': toast.success(`Claimed yield successfully!`, { icon: '🎉' }); break;
        case 'lock': toast.success(`Vault locked for ${lockDays} days!`, { icon: '🔒' }); break;
      }

      setAmount('');
      setLockAmount('');
      // Wait a moment for Horizon to sync before refreshing
      setTimeout(async () => {
        await loadVaultData(wallet.publicKey!);
        await wallet.refreshBalance();
        onStatsRefresh();
      }, 3000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Transaction failed. Please try again.', { icon: '❌' });
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'deposit', label: 'Deposit' },
    { id: 'withdraw', label: 'Withdraw' },
    { id: 'claim', label: 'Claim Yield' },
    { id: 'lock', label: 'Lock Vault' },
  ];

  const isLocked = vaultData && vaultData.lockedAmount > BigInt(0) && vaultData.lockUntil > BigInt(Math.floor(Date.now() / 1000));
  const lockEndDate = vaultData?.lockUntil ? new Date(Number(vaultData.lockUntil) * 1000) : null;
  
  let unlockedAmountStroops = vaultData?.deposited || BigInt(0);
  if (isLocked) {
    unlockedAmountStroops -= vaultData!.lockedAmount;
  }
  const unlockedAmount = Number(unlockedAmountStroops) / 10_000_000;

  return (
    <div>
      {/* Vault summary */}
      {wallet.isConnected && wallet.publicKey && (
        <div className="glass" style={{ padding: '20px 22px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Wallet</div>
            <code className="font-mono" style={{ fontSize: 13, color: 'var(--cyan-400)' }}>{formatAddress(wallet.publicKey)}</code>
          </div>
          <div style={{ height: 32, width: 1, background: 'var(--border-subtle)' }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deposited</div>
            {loadingVault
              ? <div className="skeleton" style={{ height: 20, width: 80 }} />
              : <span className="font-mono" style={{ fontSize: 16, fontWeight: 600 }}>{vaultData ? formatXLM(vaultData.deposited) : '0'} XLM</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending Yield</div>
            {loadingVault
              ? <div className="skeleton" style={{ height: 20, width: 80 }} />
              : <span className="font-mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--emerald-400)' }}>+{formatXLM(pendingYield)} XLM</span>
            }
          </div>
          {isLocked && (
            <div className="badge badge-locked">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
              {formatXLM(vaultData!.lockedAmount)} Locked until {lockEndDate?.toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Main panel */}
      <div className="glass-strong border-animated" style={{ overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto',
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                minWidth: 100,
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
                color: tab === t.id ? 'var(--cyan-400)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--cyan-400)' : '2px solid transparent',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel body */}
        <div style={{ padding: '28px 24px' }}>
          {!wallet.isConnected ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--bg-raised)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Connect your Freighter wallet to manage your vault</p>
              <button className="btn btn-primary" onClick={wallet.connect}>Connect Wallet</button>
            </div>
          ) : (
            <>
              {/* DEPOSIT */}
              {tab === 'deposit' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
                    Amount to deposit (XLM)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="0.0000"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      min="0"
                      step="0.0001"
                    />
                    <button
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--cyan-400)', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                      onClick={() => setAmount('100')}
                    >
                      MAX
                    </button>
                  </div>
                  <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg-void)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Base APY</span>
                      <span style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>5.00%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Protocol fee</span>
                      <span>0.25%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Network fee</span>
                      <span>~0.0001 XLM</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 16, padding: '14px' }}
                    onClick={handleAction}
                    disabled={!amount || loading || Number(amount) <= 0}
                  >
                    {loading ? <><Spinner /> Depositing…</> : `Deposit ${amount || '0'} XLM`}
                  </button>
                </div>
              )}

              {/* WITHDRAW */}
              {tab === 'withdraw' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
                    Amount to withdraw (XLM)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0.0000"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                  {isLocked && vaultData!.lockedAmount > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--gold-400)' }}>
                      ⚠️ {formatXLM(vaultData!.lockedAmount)} XLM is locked until {lockEndDate?.toLocaleDateString()}. You can only withdraw your {unlockedAmount.toFixed(4)} XLM unlocked balance.
                    </div>
                  )}
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: 16, padding: '14px' }}
                    onClick={handleAction}
                    disabled={!amount || loading || Number(amount) <= 0 || Number(amount) > unlockedAmount}
                  >
                    {loading ? <><Spinner /> Withdrawing…</> : `Withdraw ${amount || '0'} XLM`}
                  </button>
                </div>
              )}

              {/* CLAIM */}
              {tab === 'claim' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Available to claim</div>
                  <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--emerald-400)', marginBottom: 4 }}>
                    {formatXLM(pendingYield)}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>XLM</div>

                  {pendingYield === BigInt(0) && (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                      No yield accumulated yet. Deposit XLM to start earning.
                    </p>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{ padding: '14px 40px' }}
                    onClick={handleAction}
                    disabled={pendingYield === BigInt(0) || loading}
                  >
                    {loading ? <><Spinner /> Claiming…</> : 'Claim Yield'}
                  </button>
                </div>
              )}

              {/* LOCK */}
              {tab === 'lock' && (
                <div>
                  <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 13, color: 'var(--gold-400)', fontWeight: 600, marginBottom: 4 }}>⚡ 1.5× Yield Boost</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      Lock your vault balance to earn 7.5% APY instead of 5%. Locked funds cannot be withdrawn until the lock expires.
                    </div>
                  </div>

                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
                    Amount to lock (XLM)
                  </label>
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="0.0000"
                      value={lockAmount}
                      onChange={e => setLockAmount(e.target.value)}
                      min="0"
                      step="0.0001"
                    />
                    <button
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--cyan-400)', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                      onClick={() => setLockAmount(unlockedAmount.toString())}
                    >
                      MAX UNLOCKED
                    </button>
                  </div>

                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>
                    Lock duration (days)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                    {['7', '14', '30', '90'].map(d => (
                      <button
                        key={d}
                        onClick={() => setLockDays(d)}
                        style={{
                          padding: '10px',
                          borderRadius: 'var(--radius-md)',
                          border: lockDays === d ? '1px solid var(--gold-400)' : '1px solid var(--border-default)',
                          background: lockDays === d ? 'rgba(251,191,36,0.1)' : 'var(--bg-void)',
                          color: lockDays === d ? 'var(--gold-400)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: 'var(--font-sans)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
                    Unlocks on: <strong style={{ color: 'var(--text-primary)' }}>
                      {new Date(Date.now() + Number(lockDays) * 86_400_000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </strong>
                  </div>

                  <button
                    className="btn btn-gold"
                    style={{ width: '100%', padding: '14px' }}
                    onClick={handleAction}
                    disabled={!vaultData || loading || !lockAmount || Number(lockAmount) <= 0 || Number(lockAmount) > unlockedAmount}
                  >
                    {loading ? <><Spinner /> Locking…</> : `Lock ${lockAmount || '0'} XLM for ${lockDays} Days`}
                  </button>

                  {isLocked && vaultData!.lockedAmount > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                      You already have {formatXLM(vaultData!.lockedAmount)} XLM locked. Locking more will extend the duration for ALL locked funds.
                    </p>
                  )}
                </div>
              )}

              {/* TX Hash placeholder */}
              {lastTxHash && (
                <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--bg-void)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Last TX:&nbsp;
                  <code className="font-mono" style={{ color: 'var(--cyan-400)' }}>
                    {formatAddress(lastTxHash)}
                  </code>
                  <a href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>↗</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14,
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      display: 'inline-block',
      animation: 'spin-slow 0.7s linear infinite',
    }} />
  );
}
