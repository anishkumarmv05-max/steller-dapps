#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger, LedgerInfo},
    token, Address, Env, IntoVal,
};
use stellar_vault::{StellarVault, StellarVaultClient};

/// Helper: create test environment with default settings
fn setup_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

/// Helper: deploy vault contract
fn deploy_vault(env: &Env) -> (StellarVaultClient, Address, Address, Address) {
    let admin = Address::generate(env);
    let oracle = Address::generate(env);
    let contract_id = env.register_contract(None, StellarVault);
    let client = StellarVaultClient::new(env, &contract_id);
    client.initialize(&admin, &500u32, &oracle); // 5% APY
    (client, contract_id, admin, oracle)
}

/// Helper: create a test token
fn create_test_token<'a>(env: &'a Env, admin: &Address) -> (token::Client<'a>, Address) {
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let token_client = token::Client::new(env, &token_id);
    (token_client, token_id)
}

/// Helper: fund an address with tokens
fn fund_address(env: &Env, token: &token::Client, token_admin: &Address, to: &Address, amount: i128) {
    let admin_client = token::StellarAssetClient::new(env, &token.address);
    admin_client.mint(to, &amount);
}

// ─── Test 1: Contract Initialization ─────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let env = setup_env();
    let (client, _, admin, oracle) = deploy_vault(&env);

    let stats = client.get_stats();
    assert_eq!(stats.total_vaults, 0);
    assert_eq!(stats.total_deposited, 0);
    assert_eq!(stats.total_yield_paid, 0);
    assert_eq!(stats.protocol_fee_bps, 25);

    let rate = client.get_yield_rate();
    assert_eq!(rate, 500u32);

    let paused = client.is_paused();
    assert_eq!(paused, false);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice_fails() {
    let env = setup_env();
    let (client, _, admin, oracle) = deploy_vault(&env);
    // Try to initialize again - should panic
    client.initialize(&admin, &500u32, &oracle);
}

// ─── Test 2: Deposit ──────────────────────────────────────────────────────────

#[test]
fn test_deposit_creates_vault() {
    let env = setup_env();
    let (client, contract_id, admin, oracle) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);

    let vault = client.deposit(&user, &token_id, &100_0000000i128);

    assert_eq!(vault.owner, user);
    assert_eq!(vault.deposited, 100_0000000i128);
    assert_eq!(vault.yield_earned, 0);
    assert_eq!(vault.locked_amount, 0);

    let stats = client.get_stats();
    assert_eq!(stats.total_vaults, 1);
    assert_eq!(stats.total_deposited, 100_0000000i128);
}

#[test]
fn test_multiple_deposits_accumulate() {
    let env = setup_env();
    let (client, contract_id, admin, oracle) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);

    client.deposit(&user, &token_id, &100_0000000i128);
    client.deposit(&user, &token_id, &200_0000000i128);

    let vault = client.get_vault(&user).unwrap();
    assert_eq!(vault.deposited, 300_0000000i128);

    // Only 1 vault should be counted
    let stats = client.get_stats();
    assert_eq!(stats.total_vaults, 1);
    assert_eq!(stats.total_deposited, 300_0000000i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_zero_fails() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (_, token_id) = create_test_token(&env, &admin);
    let user = Address::generate(&env);
    client.deposit(&user, &token_id, &0i128);
}

#[test]
#[should_panic(expected = "protocol is paused")]
fn test_deposit_when_paused_fails() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);
    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);

    client.set_paused(&true);
    client.deposit(&user, &token_id, &100_0000000i128);
}

// ─── Test 3: Withdraw ─────────────────────────────────────────────────────────

#[test]
fn test_withdraw_partial() {
    let env = setup_env();
    let (client, contract_id, admin, oracle) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);

    client.deposit(&user, &token_id, &100_0000000i128);

    let net = client.withdraw(&user, &50_0000000i128);

    // Fee is 0.25% = 12_500_000 stroops on 50 XLM
    let expected_fee = 50_0000000i128 * 25 / 10_000;
    assert_eq!(net, 50_0000000i128 - expected_fee);

    let vault = client.get_vault(&user).unwrap();
    assert_eq!(vault.deposited, 50_0000000i128);
}

#[test]
#[should_panic(expected = "insufficient unlocked balance")]
fn test_withdraw_too_much_fails() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);
    client.deposit(&user, &token_id, &100_0000000i128);
    client.withdraw(&user, &200_0000000i128);
}

// ─── Test 4: Vault Locking ────────────────────────────────────────────────────

#[test]
fn test_lock_vault_success() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);
    client.deposit(&user, &token_id, &100_0000000i128);

    let lock_duration = 7 * 24 * 3600u64; // 7 days
    let vault = client.lock_vault(&user, &100_0000000i128, &lock_duration);

    assert_eq!(vault.locked_amount, 100_0000000i128);
    assert!(vault.lock_until > 0);
}

#[test]
#[should_panic(expected = "insufficient unlocked balance")]
fn test_withdraw_from_locked_vault_fails() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);
    client.deposit(&user, &token_id, &100_0000000i128);

    let lock_duration = 7 * 24 * 3600u64;
    client.lock_vault(&user, &100_0000000i128, &lock_duration);

    // Try to withdraw while locked
    client.withdraw(&user, &50_0000000i128);
}

#[test]
#[should_panic(expected = "minimum lock duration is 1 day")]
fn test_lock_too_short_fails() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);
    client.deposit(&user, &token_id, &100_0000000i128);

    client.lock_vault(&user, &100_0000000i128, &3600u64); // Only 1 hour - too short
}

// ─── Test 5: Yield Calculation ────────────────────────────────────────────────

#[test]
fn test_pending_yield_increases_over_time() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user = Address::generate(&env);
    fund_address(&env, &token, &admin, &user, 1_000_0000000i128);
    client.deposit(&user, &token_id, &100_0000000i128);

    let yield_before = client.get_pending_yield(&user);

    // Advance time by 30 days
    env.ledger().with_mut(|ledger| {
        ledger.timestamp += 30 * 24 * 3600;
    });

    let yield_after = client.get_pending_yield(&user);
    assert!(yield_after > yield_before);
}

#[test]
fn test_locked_vault_earns_more_yield() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    fund_address(&env, &token, &admin, &user1, 1_000_0000000i128);
    fund_address(&env, &token, &admin, &user2, 1_000_0000000i128);

    client.deposit(&user1, &token_id, &100_0000000i128); // regular
    client.deposit(&user2, &token_id, &100_0000000i128); // will be locked

    let lock_duration = 30 * 24 * 3600u64;
    client.lock_vault(&user2, &100_0000000i128, &lock_duration);

    // Advance 30 days
    env.ledger().with_mut(|ledger| {
        ledger.timestamp += 30 * 24 * 3600;
    });

    let yield_regular = client.get_pending_yield(&user1);
    let yield_locked = client.get_pending_yield(&user2);

    // Locked vault should earn 1.5x more
    assert!(yield_locked > yield_regular);
}

// ─── Test 6: Admin Controls ───────────────────────────────────────────────────

#[test]
fn test_admin_can_update_yield_rate() {
    let env = setup_env();
    let (client, _, _, _) = deploy_vault(&env);

    client.set_yield_rate(&1000u32); // 10% APY
    assert_eq!(client.get_yield_rate(), 1000u32);
}

#[test]
#[should_panic(expected = "rate too high")]
fn test_yield_rate_too_high_fails() {
    let env = setup_env();
    let (client, _, _, _) = deploy_vault(&env);
    client.set_yield_rate(&15_000u32); // 150% - too high
}

#[test]
fn test_admin_can_pause_protocol() {
    let env = setup_env();
    let (client, _, _, _) = deploy_vault(&env);

    assert_eq!(client.is_paused(), false);
    client.set_paused(&true);
    assert_eq!(client.is_paused(), true);
    client.set_paused(&false);
    assert_eq!(client.is_paused(), false);
}

// ─── Test 7: View Functions ───────────────────────────────────────────────────

#[test]
fn test_get_vault_returns_none_for_unknown() {
    let env = setup_env();
    let (client, _, _, _) = deploy_vault(&env);
    let stranger = Address::generate(&env);
    assert!(client.get_vault(&stranger).is_none());
}

#[test]
fn test_stats_tracks_multiple_users() {
    let env = setup_env();
    let (client, _, admin, _) = deploy_vault(&env);
    let (token, token_id) = create_test_token(&env, &admin);

    for _ in 0..3 {
        let user = Address::generate(&env);
        fund_address(&env, &token, &admin, &user, 1_000_0000000i128);
        client.deposit(&user, &token_id, &100_0000000i128);
    }

    let stats = client.get_stats();
    assert_eq!(stats.total_vaults, 3);
    assert_eq!(stats.total_deposited, 300_0000000i128);
}
