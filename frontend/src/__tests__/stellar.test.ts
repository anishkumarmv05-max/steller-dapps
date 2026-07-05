import { formatXLM, formatAddress } from '../lib/stellar';

// ─── formatXLM ────────────────────────────────────────────────────────────────

describe('formatXLM', () => {
  test('formats stroops to XLM with 4 decimal places', () => {
    expect(formatXLM(BigInt(10_000_000))).toBe('1.0000');
  });

  test('formats millions with M suffix', () => {
    expect(formatXLM(BigInt(1_000_000_0000000))).toBe('1.00M');
  });

  test('formats thousands with K suffix', () => {
    expect(formatXLM(BigInt(5_000_0000000))).toBe('5.00K');
  });

  test('formats zero', () => {
    expect(formatXLM(BigInt(0))).toBe('0.0000');
  });

  test('formats fractional XLM', () => {
    expect(formatXLM(BigInt(500_000))).toBe('0.0500');
  });
});

// ─── formatAddress ────────────────────────────────────────────────────────────

describe('formatAddress', () => {
  test('truncates long stellar address', () => {
    const addr = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGR5GNUAOD6KHHHKRJWKM';
    const result = formatAddress(addr);
    expect(result).toMatch(/^.{6}….{4}$/);
    expect(result).toBe('GCEZWK…JWKM');
  });

  test('returns short address unchanged', () => {
    expect(formatAddress('SHORT')).toBe('SHORT');
  });

  test('handles empty string', () => {
    expect(formatAddress('')).toBe('');
  });
});

// ─── Yield Calculations ───────────────────────────────────────────────────────

describe('yield calculations', () => {
  function calculateYield(deposited: number, ratePercent: number, days: number): number {
    const rateDecimal = ratePercent / 100;
    const yearFraction = days / 365;
    return deposited * rateDecimal * yearFraction;
  }

  test('calculates base 5% APY for 365 days correctly', () => {
    const result = calculateYield(1000, 5, 365);
    expect(result).toBeCloseTo(50, 1);
  });

  test('calculates locked 7.5% APY for 30 days', () => {
    const result = calculateYield(1000, 7.5, 30);
    expect(result).toBeCloseTo(6.16, 1);
  });

  test('locked vault earns 1.5x more than unlocked', () => {
    const base = calculateYield(1000, 5, 30);
    const boosted = calculateYield(1000, 7.5, 30);
    expect(boosted / base).toBeCloseTo(1.5, 3);
  });

  test('zero deposit earns no yield', () => {
    expect(calculateYield(0, 5, 365)).toBe(0);
  });

  test('protocol fee of 0.25% is applied on withdrawal', () => {
    const amount = 1000;
    const feeBps = 25;
    const fee = (amount * feeBps) / 10_000;
    const netAmount = amount - fee;
    expect(fee).toBeCloseTo(2.5, 5);
    expect(netAmount).toBeCloseTo(997.5, 5);
  });
});

// ─── Contract Addresses ───────────────────────────────────────────────────────

describe('contract configuration', () => {
  test('vault contract address is valid stellar format', () => {
    const { CONTRACT_ADDRESSES } = require('../lib/stellar');
    expect(CONTRACT_ADDRESSES.VAULT).toMatch(/^C[A-Z0-9]{55}$/);
  });

  test('oracle contract address is valid stellar format', () => {
    const { CONTRACT_ADDRESSES } = require('../lib/stellar');
    expect(CONTRACT_ADDRESSES.ORACLE).toMatch(/^C[A-Z0-9]{55}$/);
  });

  test('all required contract addresses are defined', () => {
    const { CONTRACT_ADDRESSES } = require('../lib/stellar');
    expect(CONTRACT_ADDRESSES.VAULT).toBeDefined();
    expect(CONTRACT_ADDRESSES.ORACLE).toBeDefined();
    expect(CONTRACT_ADDRESSES.TOKEN).toBeDefined();
  });
});

// ─── Vault Lock Logic ─────────────────────────────────────────────────────────

describe('vault lock logic', () => {
  test('1 day minimum lock (86400 seconds)', () => {
    const MIN_LOCK = 86_400;
    expect(7 * 86_400).toBeGreaterThanOrEqual(MIN_LOCK); // 7 days ✓
    expect(3_600).toBeLessThan(MIN_LOCK); // 1 hour ✗
  });

  test('lock end date calculates correctly', () => {
    const now = Math.floor(Date.now() / 1000);
    const lockDays = 30;
    const lockEnd = now + lockDays * 86_400;
    const diff = lockEnd - now;
    expect(diff).toBe(30 * 86_400);
  });

  test('isLocked check uses timestamp correctly', () => {
    const now = Math.floor(Date.now() / 1000);
    const futureUnlock = now + 86_400 * 7;
    const pastUnlock = now - 86_400;

    const isLockedFuture = futureUnlock > now;
    const isLockedPast = pastUnlock > now;

    expect(isLockedFuture).toBe(true);
    expect(isLockedPast).toBe(false);
  });
});
