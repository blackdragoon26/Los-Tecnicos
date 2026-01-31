#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, vec, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OrderType { Buy, Sell }

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OrderStatus { Open, Matched, Completed, Cancelled }

#[contracttype]
#[derive(Clone, Debug)]
pub struct EnergyOrder {
    pub order_id: u64,
    pub user: Address,
    pub order_type: OrderType,
    pub kwh_amount: i128,
    pub price_per_kwh: i128,
    pub status: OrderStatus,
    pub device_id: String,
}

#[contracttype]
pub enum DataKey { Admin, OrderCount, Order(u64), UserOrders(Address), EnergyToken }

#[contract]
pub struct Marketplace;

#[contractimpl]
impl Marketplace {
    pub fn initialize(env: Env, admin: Address, token_wasm_hash: Address) {
        if env.storage().instance().has(&DataKey::Admin) { panic!("already initialized"); }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EnergyToken, &token_wasm_hash);
        env.storage().instance().set(&DataKey::OrderCount, &0u64);
    }

    pub fn create_order(env: Env, user: Address, order_type: OrderType, kwh_amount: i128, price_per_kwh: i128, device_id: String) -> u64 {
        user.require_auth();
        let mut count: u64 = env.storage().instance().get(&DataKey::OrderCount).unwrap_or(0);
        count += 1;
        let order = EnergyOrder { order_id: count, user: user.clone(), order_type, kwh_amount, price_per_kwh, status: OrderStatus::Open, device_id };
        env.storage().persistent().set(&DataKey::Order(count), &order);
        env.storage().instance().set(&DataKey::OrderCount, &count);
        count
    }

    pub fn get_order(env: Env, order_id: u64) -> Option<EnergyOrder> {
        env.storage().persistent().get(&DataKey::Order(order_id))
    }
}

mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Env, String};

    #[test]
    fn test_create_order() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let token_addr = Address::generate(&env);

        let contract_id = env.register_contract(None, Marketplace);
        let client = MarketplaceClient::new(&env, &contract_id);

        client.initialize(&admin, &token_addr);
        
        env.mock_all_auths();
        let order_id = client.create_order(&user, &OrderType::Sell, &50, &10, &String::from_str(&env, "device1"));

        assert_eq!(order_id, 1);
        let order = client.get_order(&1).unwrap();
        assert_eq!(order.kwh_amount, 50);
    }
}
