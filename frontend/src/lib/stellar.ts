import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  Address,
  scValToNative,
  nativeToScVal,
  Contract,
} from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// Deployed contract addresses (testnet)
export const CONTRACT_ADDRESSES = {
  VAULT: 'CBRFJJSDFQN7SFQCVUIBPVWKOCFWDKVLRJBKSTXBOBMMAMZMRXUNASQ',
  ORACLE: 'CAOZBAHQHMTM2JQSNZNJZJMHTHD4RMRZ2CQHRMHG5XDIKGPUKPBZ6K',
  TOKEN: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2BHQGFB',
};

export const rpc = new SorobanRpc.Server(RPC_URL);

export interface VaultData {
  owner: string;
  token: string;
  deposited: bigint;
  yieldEarned: bigint;
  lastUpdated: bigint;
  isLocked: boolean;
  lockUntil: bigint;
}

export interface VaultStats {
  totalVaults: number;
  totalDeposited: bigint;
  totalYieldPaid: bigint;
  protocolFeeBps: number;
}

export async function getVault(ownerAddress: string): Promise<VaultData | null> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.VAULT);
    const ownerScVal = nativeToScVal(Address.fromString(ownerAddress), { type: 'address' });

    const result = await rpc.simulateTransaction(
      new TransactionBuilder(
        await rpc.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
        { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call('get_vault', ownerScVal))
        .setTimeout(30)
        .build()
    );

    if (SorobanRpc.Api.isSimulationSuccess(result) && result.result) {
      const val = scValToNative(result.result.retval);
      if (!val) return null;
      return {
        owner: val.owner,
        token: val.token,
        deposited: BigInt(val.deposited),
        yieldEarned: BigInt(val.yield_earned),
        lastUpdated: BigInt(val.last_updated),
        isLocked: val.is_locked,
        lockUntil: BigInt(val.lock_until),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getVaultStats(): Promise<VaultStats> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.VAULT);

    const result = await rpc.simulateTransaction(
      new TransactionBuilder(
        await rpc.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
        { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call('get_stats'))
        .setTimeout(30)
        .build()
    );

    if (SorobanRpc.Api.isSimulationSuccess(result) && result.result) {
      const val = scValToNative(result.result.retval);
      return {
        totalVaults: Number(val.total_vaults),
        totalDeposited: BigInt(val.total_deposited),
        totalYieldPaid: BigInt(val.total_yield_paid),
        protocolFeeBps: Number(val.protocol_fee_bps),
      };
    }
  } catch {}

  // Fallback demo data
  return {
    totalVaults: 1_247,
    totalDeposited: BigInt('45823000000000'),
    totalYieldPaid: BigInt('1203000000000'),
    protocolFeeBps: 25,
  };
}

export async function getPendingYield(ownerAddress: string): Promise<bigint> {
  try {
    const contract = new Contract(CONTRACT_ADDRESSES.VAULT);
    const ownerScVal = nativeToScVal(Address.fromString(ownerAddress), { type: 'address' });

    const result = await rpc.simulateTransaction(
      new TransactionBuilder(
        await rpc.getAccount('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'),
        { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE }
      )
        .addOperation(contract.call('get_pending_yield', ownerScVal))
        .setTimeout(30)
        .build()
    );

    if (SorobanRpc.Api.isSimulationSuccess(result) && result.result) {
      return BigInt(scValToNative(result.result.retval) ?? 0);
    }
  } catch {}
  return BigInt(0);
}

export function formatXLM(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  if (xlm >= 1_000_000) return `${(xlm / 1_000_000).toFixed(2)}M`;
  if (xlm >= 1_000) return `${(xlm / 1_000).toFixed(2)}K`;
  return xlm.toFixed(4);
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
