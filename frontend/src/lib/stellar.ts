import {
  SorobanRpc,
  Horizon,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  Address,
  scValToNative,
  nativeToScVal,
  Contract,
  Account,
} from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// Deployed contract addresses (testnet)
export const CONTRACT_ADDRESSES = {
  VAULT: 'CCIMKAWGJKAFMHH62NWFQJVXDETZFQONYHKW7WGODT6FQLULUSZDZLDQ',
  ORACLE: 'CBDJT4YBL5C7GSHB7TEKKS3C6WAX5SWT4652H4R7A4MYL75S6LQ7YRPS',
  TOKEN: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
};

export const rpc = new SorobanRpc.Server(RPC_URL);
export const horizon = new Horizon.Server(HORIZON_URL);

export interface VaultData {
  owner: string;
  token: string;
  deposited: bigint;
  yieldEarned: bigint;
  lastUpdated: bigint;
  lockedAmount: bigint;
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
        new Account(ownerAddress, "0"),
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
        lockedAmount: BigInt(val.locked_amount),
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
        new Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', "0"),
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
        new Account(ownerAddress, "0"),
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

export async function getTokenBalance(publicKey: string): Promise<bigint> {
  try {
    // For native XLM (which is what we use), it's much faster and more reliable
    // to query Horizon directly rather than simulating a Soroban transaction.
    const account = await horizon.loadAccount(publicKey);
    const nativeBalance = account.balances.find(b => b.asset_type === 'native');
    
    if (nativeBalance) {
      // Convert string "100.0000000" to stroops bigint
      const stroops = Math.floor(parseFloat(nativeBalance.balance) * 10_000_000);
      return BigInt(stroops);
    }
  } catch (err: any) {
    // A 404 means the account is completely new/unfunded on testnet.
    // It exists in the wallet but not on the ledger yet.
  }
  return BigInt(0);
}

export async function buildContractTransaction(publicKey: string, method: string, args: any[] = []): Promise<string> {
  const contract = new Contract(CONTRACT_ADDRESSES.VAULT);
  
  let account;
  try {
    account = await horizon.loadAccount(publicKey);
  } catch (err: any) {
    if (err.response && err.response.status === 404) {
      throw new Error("Your account is not funded on Testnet. Please fund it with Friendbot first!");
    }
    throw err;
  }

  let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${typeof sim.error === 'string' ? sim.error : JSON.stringify(sim.error)}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    throw new Error("Simulation failed with unknown reason");
  }

  tx = SorobanRpc.assembleTransaction(tx, sim).build();
  return tx.toXDR();
}

export async function submitTransaction(signedXdr: string): Promise<string | null> {
  const sendResult = await rpc.sendTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE) as any);
  
  if (sendResult.status === 'ERROR') {
    throw new Error('Transaction submission failed');
  }

  // Poll for completion
  let status = await rpc.getTransaction(sendResult.hash);
  while (status.status === 'NOT_FOUND') {
    await new Promise(r => setTimeout(r, 2000));
    status = await rpc.getTransaction(sendResult.hash);
  }

  if (status.status === 'SUCCESS') {
    return sendResult.hash;
  } else {
    throw new Error('Transaction failed on-chain');
  }
}
