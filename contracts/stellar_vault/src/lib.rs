#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contractclient,
    Address, Env, Symbol, token,
};

// ─── Data Types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vault {
    pub owner: Address,
    pub token: Address,
    pub deposited: i128,
    pub yield_earned: i128,
    pub last_updated: u64,
    pub locked_amount: i128,
    pub lock_until: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultStats {
    pub total_vaults: u32,
    pub total_deposited: i128,
    pub total_yield_paid: i128,
    pub protocol_fee_bps: u32,
}

#[contracttype]
pub enum DataKey {
    Vault(Address),
    Stats,
    Admin,
    Paused,
    YieldRate,
    OracleContract,
}

// ─── Events ─────────────────────────────────────────────────────────────────

fn emit_deposit(env: &Env, owner: &Address, amount: i128) {
    let topics = (Symbol::new(env, "deposit"), owner.clone());
    env.events().publish(topics, amount);
}

fn emit_withdraw(env: &Env, owner: &Address, amount: i128) {
    let topics = (Symbol::new(env, "withdraw"), owner.clone());
    env.events().publish(topics, amount);
}

fn emit_yield_claimed(env: &Env, owner: &Address, yield_amount: i128) {
    let topics = (Symbol::new(env, "yield_claimed"), owner.clone());
    env.events().publish(topics, yield_amount);
}

fn emit_vault_locked(env: &Env, owner: &Address, until: u64) {
    let topics = (Symbol::new(env, "vault_locked"), owner.clone());
    env.events().publish(topics, until);
}

// ─── Oracle Interface (Inter-contract communication) ─────────────────────────

#[contractclient(name = "OracleClient")]
pub trait OracleTrait {
    fn get_rate(env: Env, token: Address) -> i128;
    fn is_active(env: Env) -> bool;
}

// ─── Main Contract ────────────────────────────────────────────────────────────

#[contract]
pub struct StellarVault;

#[contractimpl]
impl StellarVault {
    /// Initialize the vault protocol
    pub fn initialize(
        env: Env,
        admin: Address,
        yield_rate_bps: u32,
        oracle: Address,
    ) -> bool {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::YieldRate, &yield_rate_bps);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::OracleContract, &oracle);
        env.storage().instance().set(
            &DataKey::Stats,
            &VaultStats {
                total_vaults: 0,
                total_deposited: 0,
                total_yield_paid: 0,
                protocol_fee_bps: 25, // 0.25%
            },
        );

        true
    }

    /// Deposit tokens into a vault
    pub fn deposit(env: Env, owner: Address, token: Address, amount: i128) -> Vault {
        owner.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic!("protocol is paused");
        }

        // Transfer tokens to vault contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&owner, &env.current_contract_address(), &amount);

        let vault = if env.storage().persistent().has(&DataKey::Vault(owner.clone())) {
            let mut existing: Vault = env
                .storage()
                .persistent()
                .get(&DataKey::Vault(owner.clone()))
                .unwrap();
            let accrued = Self::calculate_yield(&env, &existing);
            existing.yield_earned += accrued;
            existing.deposited += amount;
            existing.last_updated = env.ledger().timestamp();
            existing
        } else {
            let mut stats: VaultStats = env.storage().instance().get(&DataKey::Stats).unwrap();
            stats.total_vaults += 1;
            env.storage().instance().set(&DataKey::Stats, &stats);

            Vault {
                owner: owner.clone(),
                token: token.clone(),
                deposited: amount,
                yield_earned: 0,
                last_updated: env.ledger().timestamp(),
                locked_amount: 0,
                lock_until: 0,
            }
        };

        let mut stats: VaultStats = env.storage().instance().get(&DataKey::Stats).unwrap();
        stats.total_deposited += amount;
        env.storage().instance().set(&DataKey::Stats, &stats);

        env.storage().persistent().set(&DataKey::Vault(owner.clone()), &vault);

        emit_deposit(&env, &owner, amount);

        vault
    }

    /// Withdraw tokens from vault
    pub fn withdraw(env: Env, owner: Address, amount: i128) -> i128 {
        owner.require_auth();

        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&DataKey::Vault(owner.clone()))
            .expect("vault not found");

        let mut unlocked_amount = vault.deposited;
        if env.ledger().timestamp() < vault.lock_until {
            unlocked_amount -= vault.locked_amount;
        }

        if amount > unlocked_amount {
            panic!("insufficient unlocked balance");
        }

        let accrued = Self::calculate_yield(&env, &vault);
        vault.yield_earned += accrued;
        
        if env.ledger().timestamp() >= vault.lock_until && vault.locked_amount > 0 {
            vault.locked_amount = 0;
            vault.lock_until = 0;
        }
        vault.deposited -= amount;
        vault.last_updated = env.ledger().timestamp();

        let stats: VaultStats = env.storage().instance().get(&DataKey::Stats).unwrap();
        let fee = (amount * stats.protocol_fee_bps as i128) / 10_000;
        let net_amount = amount - fee;

        let token_client = token::Client::new(&env, &vault.token);
        token_client.transfer(&env.current_contract_address(), &owner, &net_amount);

        env.storage().persistent().set(&DataKey::Vault(owner.clone()), &vault);

        let mut stats: VaultStats = env.storage().instance().get(&DataKey::Stats).unwrap();
        stats.total_deposited -= amount;
        env.storage().instance().set(&DataKey::Stats, &stats);

        emit_withdraw(&env, &owner, net_amount);

        net_amount
    }

    /// Claim accumulated yield
    pub fn claim_yield(env: Env, owner: Address) -> i128 {
        owner.require_auth();

        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&DataKey::Vault(owner.clone()))
            .expect("vault not found");

        let accrued = Self::calculate_yield(&env, &vault);
        let total_yield = vault.yield_earned + accrued;

        if total_yield == 0 {
            panic!("no yield to claim");
        }

        vault.yield_earned = 0;
        vault.last_updated = env.ledger().timestamp();
        
        if env.ledger().timestamp() >= vault.lock_until && vault.locked_amount > 0 {
            vault.locked_amount = 0;
            vault.lock_until = 0;
        }

        let token_client = token::Client::new(&env, &vault.token);
        token_client.transfer(&env.current_contract_address(), &owner, &total_yield);

        env.storage().persistent().set(&DataKey::Vault(owner.clone()), &vault);

        let mut stats: VaultStats = env.storage().instance().get(&DataKey::Stats).unwrap();
        stats.total_yield_paid += total_yield;
        env.storage().instance().set(&DataKey::Stats, &stats);

        emit_yield_claimed(&env, &owner, total_yield);

        total_yield
    }

    pub fn lock_vault(env: Env, owner: Address, amount: i128, lock_duration_secs: u64) -> Vault {
        owner.require_auth();

        if lock_duration_secs < 86400 {
            panic!("minimum lock duration is 1 day");
        }
        
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let mut vault: Vault = env
            .storage()
            .persistent()
            .get(&DataKey::Vault(owner.clone()))
            .expect("vault not found");

        let accrued = Self::calculate_yield(&env, &vault);
        vault.yield_earned += accrued;
        vault.last_updated = env.ledger().timestamp();

        if env.ledger().timestamp() >= vault.lock_until {
            vault.locked_amount = 0;
        }
        
        let new_locked = vault.locked_amount + amount;
        if new_locked > vault.deposited {
            panic!("cannot lock more than deposited");
        }

        let until = env.ledger().timestamp() + lock_duration_secs;
        vault.locked_amount = new_locked;
        vault.lock_until = until;

        env.storage().persistent().set(&DataKey::Vault(owner.clone()), &vault);

        emit_vault_locked(&env, &owner, until);

        vault
    }

    /// Inter-contract call to Oracle for live rates
    pub fn get_oracle_rate(env: Env, oracle: Address, token: Address) -> i128 {
        let oracle_client = OracleClient::new(&env, &oracle);
        oracle_client.get_rate(&token)
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    pub fn get_vault(env: Env, owner: Address) -> Option<Vault> {
        env.storage().persistent().get(&DataKey::Vault(owner))
    }

    pub fn get_stats(env: Env) -> VaultStats {
        env.storage().instance().get(&DataKey::Stats).unwrap_or(VaultStats {
            total_vaults: 0,
            total_deposited: 0,
            total_yield_paid: 0,
            protocol_fee_bps: 25,
        })
    }

    pub fn get_pending_yield(env: Env, owner: Address) -> i128 {
        let vault: Option<Vault> = env.storage().persistent().get(&DataKey::Vault(owner));
        match vault {
            Some(v) => {
                let accrued = Self::calculate_yield(&env, &v);
                v.yield_earned + accrued
            }
            None => 0,
        }
    }

    pub fn get_yield_rate(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::YieldRate).unwrap_or(500)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    // ─── Admin Functions ──────────────────────────────────────────────────────

    pub fn set_paused(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn set_yield_rate(env: Env, new_rate_bps: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();
        if new_rate_bps > 10_000 {
            panic!("rate too high");
        }
        env.storage().instance().set(&DataKey::YieldRate, &new_rate_bps);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    fn calculate_yield(env: &Env, vault: &Vault) -> i128 {
        let now = env.ledger().timestamp();
        if now <= vault.last_updated || vault.deposited == 0 {
            return 0;
        }

        let elapsed_secs = (now - vault.last_updated) as i128;
        let rate_bps: u32 = env.storage().instance().get(&DataKey::YieldRate).unwrap_or(500);

        let unlocked_amount = vault.deposited - vault.locked_amount;
        let normal_rate = rate_bps as i128;
        let boosted_rate = rate_bps as i128 * 15 / 10;

        let seconds_per_year: i128 = 31_536_000;
        let unlocked_yield = (unlocked_amount * normal_rate * elapsed_secs) / (10_000 * seconds_per_year);
        let locked_yield = (vault.locked_amount * boosted_rate * elapsed_secs) / (10_000 * seconds_per_year);

        unlocked_yield + locked_yield
    }
}
