#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    TotalSupply,
    TotalBurned,
}

#[contract]
pub struct EnergyToken;

#[contractimpl]
impl EnergyToken {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        env.storage().instance().set(&DataKey::TotalBurned, &0i128);
    }

    /// Mint new energy tokens when a donor discharges energy.
    /// Only callable by the oracle/admin backend.
    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let balance = Self::get_balance(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(to), &(balance + amount));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply + amount));
    }

    /// Burn tokens after energy has been consumed by the receiver.
    /// Permanently removes tokens from circulation.
    pub fn burn(env: Env, from: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let balance = Self::get_balance(env.clone(), from.clone());
        if balance < amount {
            panic!("insufficient balance to burn");
        }
        env.storage().persistent().set(&DataKey::Balance(from), &(balance - amount));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply - amount));

        let burned: i128 = env.storage().instance().get(&DataKey::TotalBurned).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalBurned, &(burned + amount));
    }

    /// Transfer tokens between wallets (used during marketplace settlement).
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        let from_balance = Self::get_balance(env.clone(), from.clone());
        if from_balance < amount {
            panic!("insufficient balance to transfer");
        }

        let to_balance = Self::get_balance(env.clone(), to.clone());
        env.storage().persistent().set(&DataKey::Balance(from), &(from_balance - amount));
        env.storage().persistent().set(&DataKey::Balance(to), &(to_balance + amount));
    }

    pub fn get_balance(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Balance(user)).unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    pub fn total_burned(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalBurned).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_mint_and_burn() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        let contract_id = env.register(EnergyToken, ());
        let client = EnergyTokenClient::new(&env, &contract_id);

        client.initialize(&admin);
        
        env.mock_all_auths();

        // Mint 1000 tokens (1 kWh)
        client.mint(&user, &1000);
        assert_eq!(client.get_balance(&user), 1000);
        assert_eq!(client.total_supply(), 1000);

        // Burn 500 tokens (0.5 kWh consumed)
        client.burn(&user, &500);
        assert_eq!(client.get_balance(&user), 500);
        assert_eq!(client.total_supply(), 500);
        assert_eq!(client.total_burned(), 500);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let seller = Address::generate(&env);
        let buyer = Address::generate(&env);

        let contract_id = env.register(EnergyToken, ());
        let client = EnergyTokenClient::new(&env, &contract_id);

        client.initialize(&admin);
        env.mock_all_auths();

        client.mint(&seller, &1000);
        client.transfer(&seller, &buyer, &400);

        assert_eq!(client.get_balance(&seller), 600);
        assert_eq!(client.get_balance(&buyer), 400);
        assert_eq!(client.total_supply(), 1000); // supply unchanged by transfer
    }
}

