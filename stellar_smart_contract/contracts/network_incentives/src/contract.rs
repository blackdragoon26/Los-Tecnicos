#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug)]
pub struct NetworkNode {
    pub operator: Address,
    pub packets_routed: u64,
    pub rewards_earned: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Node(String),
}

#[contract]
pub struct NetworkIncentives;

#[contractimpl]
impl NetworkIncentives {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn register_node(env: Env, node_id: String, operator: Address) {
        operator.require_auth();
        
        let node = NetworkNode {
            operator,
            packets_routed: 0,
            rewards_earned: 0,
        };
        
        env.storage().persistent().set(&DataKey::Node(node_id), &node);
    }

    pub fn report_activity(env: Env, node_id: String, packets: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();

        let mut node: NetworkNode = env.storage().persistent().get(&DataKey::Node(node_id.clone())).expect("node not found");
        node.packets_routed += packets;
        
        let new_rewards = (packets / 100) as i128;
        node.rewards_earned += new_rewards;

        env.storage().persistent().set(&DataKey::Node(node_id), &node);
    }

    pub fn get_node_info(env: Env, node_id: String) -> Option<NetworkNode> {
        env.storage().persistent().get(&DataKey::Node(node_id))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    #[test]
    fn test_network_incentives() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let operator = Address::generate(&env);
        let node_id = String::from_str(&env, "pi-01");

        let contract_id = env.register(NetworkIncentives, ());
        let client = NetworkIncentivesClient::new(&env, &contract_id);

        client.initialize(&admin);
        client.register_node(&node_id, &operator);

        client.report_activity(&node_id, &500);

        let node = client.get_node_info(&node_id).unwrap();
        assert_eq!(node.packets_routed, 500);
        assert_eq!(node.rewards_earned, 5); 
    }
}
