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
        
        // Simple reward calculation: 1 stroop per 100 packets
        let new_rewards = (packets / 100) as i128;
        node.rewards_earned += new_rewards;

        env.storage().persistent().set(&DataKey::Node(node_id), &node);
    }

    pub fn get_node_info(env: Env, node_id: String) -> Option<NetworkNode> {
        env.storage().persistent().get(&DataKey::Node(node_id))
    }
}
