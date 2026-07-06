'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTokenBalance } from '../lib/stellar';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  isFreighterInstalled: boolean;
  isLoading: boolean;
  error: string | null;
  balance: bigint;
}

interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

// Safely extract a string key from various freighter-api return shapes
function extractKey(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r['publicKey'] === 'string') return r['publicKey'];
    if (typeof r['address'] === 'string') return r['address'];
  }
  return '';
}

// Safely check connection status from various freighter-api return shapes
function extractConnected(result: unknown): boolean {
  if (typeof result === 'boolean') return result;
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r['isConnected'] === 'boolean') return r['isConnected'];
  }
  return false;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    isFreighterInstalled: false,
    isLoading: false,
    error: null,
    balance: BigInt(0),
  });

  useEffect(() => {
    checkFreighter();
  }, []);

  const refreshBalance = useCallback(async (pk?: string) => {
    const keyToUse = pk || state.publicKey;
    if (!keyToUse) return;
    const balance = await getTokenBalance(keyToUse);
    setState(prev => ({ ...prev, balance }));
  }, [state.publicKey]);

  const checkFreighter = async () => {
    try {
      if (typeof window === 'undefined') return;

      // Dynamic import to avoid SSR issues
      const freighter = await import('@stellar/freighter-api');
      const freighterModule = freighter as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;

      const connResult = await freighterModule['isConnected']();
      const connected = extractConnected(connResult);

      setState(prev => ({ ...prev, isFreighterInstalled: true }));

      if (connected && freighterModule['getPublicKey']) {
        const keyResult = await freighterModule['getPublicKey']();
        const pk = extractKey(keyResult);
        setState(prev => ({
          ...prev,
          isConnected: true,
          publicKey: pk,
        }));
        refreshBalance(pk);
      }
    } catch {
      setState(prev => ({ ...prev, isFreighterInstalled: false }));
    }
  };

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const freighter = await import('@stellar/freighter-api');
      const freighterModule = freighter as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;

      // setAllowed (v1.7+) replaced requestAccess (v1.6 and below)
      const requestFn = freighterModule['setAllowed'] ?? freighterModule['requestAccess'];
      if (typeof requestFn === 'function') {
        await requestFn();
      }

      const keyResult = await freighterModule['getPublicKey']();
      const pk = extractKey(keyResult);
      setState(prev => ({
        ...prev,
        isConnected: true,
        publicKey: pk,
        isLoading: false,
      }));
      refreshBalance(pk);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      publicKey: null,
      balance: BigInt(0),
    }));
  }, []);

  return { ...state, connect, disconnect, refreshBalance };
}
