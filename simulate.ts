import { SorobanRpc, TransactionBuilder, Networks, BASE_FEE, Address, nativeToScVal, Contract, Horizon } from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const rpc = new SorobanRpc.Server(RPC_URL);
const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
const VAULT = 'CBRFJJSDFQN7SFQCVUIBPVWKOCFWDKVLRJBKSTXBOBMMAMZMRXUNASQ';
const TOKEN = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2BHQGFB';

async function test() {
  try {
    const contract = new Contract(VAULT);
    // Use the user's public key
    const publicKey = 'GCW36T47Q4C6K6G224QZOMZ747MTRVGBQ36O2ZJRYO55E2GIVG33IK35'; // from screenshot
    
    console.log("Loading account...");
    const account = await horizon.loadAccount(publicKey);
    console.log("Account loaded. Sequence:", account.sequence);

    const ownerScVal = nativeToScVal(Address.fromString(publicKey), { type: 'address' });
    const tokenScVal = nativeToScVal(Address.fromString(TOKEN), { type: 'address' });
    const amountScVal = nativeToScVal(BigInt(100_000_000), { type: 'i128' }); // 10 XLM

    console.log("Building tx...");
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(contract.call('deposit', ownerScVal, tokenScVal, amountScVal))
      .setTimeout(30)
      .build();

    console.log("Simulating tx...");
    const sim = await rpc.simulateTransaction(tx);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      console.log("Simulation error:", sim.error);
    } else {
      console.log("Simulation success:", sim.events?.map(e => e.type));
      console.log("Simulation Result:", JSON.stringify(sim, null, 2));
    }
  } catch (err: any) {
    console.error("Caught error:", err?.response?.data || err.message);
  }
}

test();
