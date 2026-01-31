#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec, vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus { Active, Passed, Rejected, Executed }

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub proposer: Address,
    pub votes_yes: i128,
    pub votes_no: i128,
    pub status: ProposalStatus,
    pub deadline: u64,
}

#[contracttype]
pub enum DataKey { Admin, ProposalCount, Prop(u64), Member(Address) }

#[contract]
pub struct Governance;

#[contractimpl]
impl Governance {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) { panic!("already initialized"); }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
    }

    pub fn create_proposal(env: Env, proposer: Address, title: String, description: String, duration: u64) -> u64 {
        proposer.require_auth();
        
        let mut count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0);
        count += 1;

        let proposal = Proposal {
            id: count,
            title,
            description,
            proposer: proposer.clone(),
            votes_yes: 0,
            votes_no: 0,
            status: ProposalStatus::Active,
            deadline: env.ledger().timestamp() + duration,
        };

        env.storage().persistent().set(&DataKey::Prop(count), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &count);
        count
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) {
        voter.require_auth();
        
        let mut proposal: Proposal = env.storage().persistent().get(&DataKey::Prop(proposal_id)).expect("proposal not found");
        
        if env.ledger().timestamp() > proposal.deadline {
            panic!("voting period ended");
        }
        
        if proposal.status != ProposalStatus::Active {
            panic!("proposal not active");
        }

        if support {
            proposal.votes_yes += 1;
        } else {
            proposal.votes_no += 1;
        }

        env.storage().persistent().set(&DataKey::Prop(proposal_id), &proposal);
    }

    pub fn finalize_proposal(env: Env, proposal_id: u64) {
        let mut proposal: Proposal = env.storage().persistent().get(&DataKey::Prop(proposal_id)).expect("proposal not found");
        
        if env.ledger().timestamp() <= proposal.deadline {
            panic!("voting period not ended");
        }

        if proposal.votes_yes > proposal.votes_no {
            proposal.status = ProposalStatus::Passed;
        } else {
            proposal.status = ProposalStatus::Rejected;
        }

        env.storage().persistent().set(&DataKey::Prop(proposal_id), &proposal);
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Prop(proposal_id))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::Env;

    #[test]
    fn test_governance_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);

        let contract_id = env.register(Governance, ());
        let client = GovernanceClient::new(&env, &contract_id);

        client.initialize(&admin);

        let prop_id = client.create_proposal(
            &proposer,
            &String::from_str(&env, "Upgrade Grid"),
            &String::from_str(&env, "Install more batteries"),
            &3600
        );

        assert_eq!(prop_id, 1);

        client.vote(&voter, &1, &true);
        let prop = client.get_proposal(&1).unwrap();
        assert_eq!(prop.votes_yes, 1);

        // Fast forward time
        env.ledger().set_timestamp(3601);
        client.finalize_proposal(&1);

        let final_prop = client.get_proposal(&1).unwrap();
        assert_eq!(final_prop.status, ProposalStatus::Passed);
    }
}
