#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

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

    pub fn match_orders(env: Env, sell_id: u64, buy_id: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut sell_order = get_order(env.clone(), sell_id).expect("sell order not found");
        let mut buy_order = get_order(env.clone(), buy_id).expect("buy order not found");

        if sell_order.status != OrderStatus::Open || buy_order.status != OrderStatus::Open {
            panic!("orders must be open");
        }

        if sell_order.order_type != OrderType::Sell || buy_order.order_type != OrderType::Buy {
            panic!("invalid order types for matching");
        }

        if sell_order.kwh_amount != buy_order.kwh_amount {
            panic!("amounts must match");
        }

        if buy_order.price_per_kwh < sell_order.price_per_kwh {
            panic!("buy price too low");
        }

        // DeFi Integration: Lock funds and calculate yield
        // In a live system, this would call an external Liquidity Pool contract
        let yield_generated = Self::calculate_yield(env.clone(), sell_order.kwh_amount * sell_order.price_per_kwh);
        
        // Log or Store yield (Simulated by updating order metadata in a real complex struct)
        // For MVP, we just mark as Completed (funds released + yield paid)
        sell_order.status = OrderStatus::Completed;
        buy_order.status = OrderStatus::Completed;

        env.storage().persistent().set(&DataKey::Order(sell_id), &sell_order);
        env.storage().persistent().set(&DataKey::Order(buy_id), &buy_order);
    }

    pub fn calculate_yield(_env: Env, amount: i128) -> i128 {
        // Simulate 5% APY for the duration of the trade lock
        // Simple calculation: 5% of total amount
        amount * 5 / 100
    }
}

pub fn get_order(env: Env, order_id: u64) -> Option<EnergyOrder> {
    env.storage().persistent().get(&DataKey::Order(order_id))
}

#[cfg(test)]
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

        let contract_id = env.register(Marketplace, ());
        let client = MarketplaceClient::new(&env, &contract_id);

        client.initialize(&admin, &token_addr);
        
        env.mock_all_auths();
        let order_id = client.create_order(&user, &OrderType::Sell, &50, &10, &String::from_str(&env, "device1"));

        assert_eq!(order_id, 1);
        let order = client.get_order(&1).unwrap();
        assert_eq!(order.kwh_amount, 50);
    }

    #[test]
    fn test_match_orders() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let seller = Address::generate(&env);
        let buyer = Address::generate(&env);
        let token_addr = Address::generate(&env);

        let contract_id = env.register(Marketplace, ());
        let client = MarketplaceClient::new(&env, &contract_id);

        client.initialize(&admin, &token_addr);
        
        env.mock_all_auths();
        let sell_id = client.create_order(&seller, &OrderType::Sell, &50, &10, &String::from_str(&env, "device1"));
        let buy_id = client.create_order(&buyer, &OrderType::Buy, &50, &12, &String::from_str(&env, "device2"));

        client.match_orders(&sell_id, &buy_id);

        let sell_order = client.get_order(&sell_id).unwrap();
        let buy_order = client.get_order(&buy_id).unwrap();

        assert_eq!(sell_order.status, OrderStatus::Completed);
        assert_eq!(buy_order.status, OrderStatus::Completed);
    }
}
