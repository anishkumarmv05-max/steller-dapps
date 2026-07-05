'use client';

import { useState, useEffect, useCallback } from 'react';

interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  isFreighterInstalled: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    isFreighterInstalled: false,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    checkFreighter();
  }, []);

  const checkFreighter = async () => {
    try {
      // Check if Freighter is installed
      if (typeof window !== 'undefined') {
        const { isConnected, getPublicKey } = await import('@stellar/freighter-api');
        const connected = await isConnected();
        
        setState(prev => ({ ...prev, isFreighterInstalled: true }));
        
        if (connected) {
          const key = await getPublicKey();
          setState(prev => ({
            ...prev,
            isConnected: true,
            publicKey: key,
          }));
        }
      }
    } catch {
      // Freighter not installed or not available
      setState(prev => ({ ...prev, isFreighterInstalled: false }));
    }
  };

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { requestAccess, getPublicKey } = await import('@stellar/freighter-api');
      await requestAccess();
      const key = await getPublicKey();
      setState(prev => ({
        ...prev,
        isConnected: true,
        publicKey: key,
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      publicKey: null,
    }));
  }, []);

  return { ...state, connect, disconnect };
}
