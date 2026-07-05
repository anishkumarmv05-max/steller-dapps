#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, Symbol};

#[contracttype]
pub enum OracleKey {
    Rate(Address),
    Admin,
    LastUpdated,
}

#[contract]
pub struct PriceOracle;

#[contractimpl]
impl PriceOracle {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&OracleKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&OracleKey::Admin, &admin);
    }

    /// Set token rate (admin only) - rate in basis points * 1000
    pub fn set_rate(env: Env, token: Address, rate: i128) {
        let admin: Address = env.storage().instance().get(&OracleKey::Admin).expect("not initialized");
        admin.require_auth();
        env.storage().persistent().set(&OracleKey::Rate(token.clone()), &rate);
        env.storage().instance().set(&OracleKey::LastUpdated, &env.ledger().timestamp());

        let topics = (Symbol::new(&env, "rate_updated"), token);
        env.events().publish(topics, rate);
    }

    /// Get token rate - called by StellarVault via inter-contract invocation
    pub fn get_rate(env: Env, token: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&OracleKey::Rate(token))
            .unwrap_or(1_000_000) // Default 1.0 USD if not set
    }

    pub fn is_active(env: Env) -> bool {
        env.storage().instance().has(&OracleKey::Admin)
    }

    pub fn get_last_updated(env: Env) -> u64 {
        env.storage().instance().get(&OracleKey::LastUpdated).unwrap_or(0)
    }
}
