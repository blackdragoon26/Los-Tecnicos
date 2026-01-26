use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("YourProgramIDHere");

// Constants
pub const ENERGY_TOKEN_DECIMALS: u8 = 6;
pub const KWH_TO_TOKEN_RATIO: u64 = 100_000; // 1 kWh = 0.1 USDC equivalent = 100,000 units (6 decimals)

#[program]
pub mod decentralized_energy_grid {
    use super::*;

    // Initialize the community energy grid
    pub fn initialize_community(ctx: Context<InitializeCommunity>, community_name: String) -> Result<()> {
        let community = &mut ctx.accounts.community;
        community.community_name = community_name;
        community.owner = ctx.accounts.authority.key();
        community.energy_token_mint = ctx.accounts.energy_token_mint.key();
        community.bump = ctx.bumps.community;
        Ok(())
    }

    // Register a new resident in the community
    pub fn register_resident(
        ctx: Context<RegisterResident>,
        resident_type: ResidentType,
        name: String,
    ) -> Result<()> {
        let resident = &mut ctx.accounts.resident;
        resident.community = ctx.accounts.community.key();
        resident.authority = ctx.accounts.authority.key();
        resident.resident_type = resident_type;
        resident.name = name;
        resident.energy_balance = 0;
        resident.bump = ctx.bumps.resident;
        Ok(())
    }

    // Producer: Mint energy tokens based on excess energy generated
    pub fn mint_energy_tokens(ctx: Context<MintEnergyTokens>, kwh_amount: u64) -> Result<()> {
        // Verify resident is a producer
        require!(
            ctx.accounts.resident.resident_type == ResidentType::Producer,
            EnergyGridError::NotAProducer
        );

        // Calculate token amount (1 kWh = KWH_TO_TOKEN_RATIO tokens)
        let token_amount = kwh_amount * KWH_TO_TOKEN_RATIO;

        // Mint tokens to resident's token account
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.energy_token_mint.to_account_info(),
                    to: ctx.accounts.resident_token_account.to_account_info(),
                    authority: ctx.accounts.community.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Update resident's energy balance
        ctx.accounts.resident.energy_balance += token_amount;

        emit!(EnergyMinted {
            resident: ctx.accounts.resident.key(),
            amount: token_amount,
            kwh: kwh_amount,
        });

        Ok(())
    }

    // Consumer: Purchase energy from the grid
    pub fn purchase_energy(ctx: Context<PurchaseEnergy>, token_amount: u64) -> Result<()> {
        // Verify resident is a consumer
        require!(
            ctx.accounts.resident.resident_type == ResidentType::Consumer,
            EnergyGridError::NotAConsumer
        );

        // Verify sufficient balance
        require!(
            ctx.accounts.resident.energy_balance >= token_amount,
            EnergyGridError::InsufficientBalance
        );

        // Transfer tokens from buyer to seller (simplified - in real implementation, match with actual seller)
        // For MVP, we'll assume there's always supply available
        // In production, this would involve an order matching system

        // Burn tokens from consumer
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.energy_token_mint.to_account_info(),
                    from: ctx.accounts.resident_token_account.to_account_info(),
                    authority: ctx.accounts.resident.to_account_info(),
                },
            ),
            token_amount,
        )?;

        // Update resident's energy balance
        ctx.accounts.resident.energy_balance -= token_amount;

        emit!(EnergyPurchased {
            resident: ctx.accounts.resident.key(),
            amount: token_amount,
        });

        Ok(())
    }
}

// Accounts
#[derive(Accounts)]
pub struct InitializeCommunity<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        seeds = [b"community", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 100
    )]
    pub community: Account<'info, Community>,
    
    #[account(
        init,
        seeds = [b"energy_token_mint", community.key().as_ref()],
        bump,
        payer = authority,
        mint::decimals = ENERGY_TOKEN_DECIMALS,
        mint::authority = community,
    )]
    pub energy_token_mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RegisterResident<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner @ EnergyGridError::Unauthorized,
    )]
    pub community: Account<'info, Community>,
    
    #[account(
        init,
        seeds = [b"resident", authority.key().as_ref(), community.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 100 + 8 + 1
    )]
    pub resident: Account<'info, Resident>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintEnergyTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        has_one = authority @ EnergyGridError::Unauthorized,
    )]
    pub resident: Account<'info, Resident>,
    
    #[account(
        mut,
        has_one = owner @ EnergyGridError::Unauthorized,
    )]
    pub community: Account<'info, Community>,
    
    #[account(
        mut,
        mint::authority = community,
    )]
    pub energy_token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = energy_token_mint,
        associated_token::authority = resident,
    )]
    pub resident_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchaseEnergy<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        has_one = authority @ EnergyGridError::Unauthorized,
    )]
    pub resident: Account<'info, Resident>,
    
    #[account(
        mut,
        has_one = owner @ EnergyGridError::Unauthorized,
    )]
    pub community: Account<'info, Community>,
    
    #[account(
        mut,
        mint::authority = community,
    )]
    pub energy_token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = energy_token_mint,
        associated_token::authority = resident,
    )]
    pub resident_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// Data Structures
#[account]
pub struct Community {
    pub community_name: String,
    pub owner: Pubkey,
    pub energy_token_mint: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Resident {
    pub community: Pubkey,
    pub authority: Pubkey,
    pub resident_type: ResidentType,
    pub name: String,
    pub energy_balance: u64, // Stored in token units (not kWh)
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ResidentType {
    Producer,
    Consumer,
}

// Events
#[event]
pub struct EnergyMinted {
    pub resident: Pubkey,
    pub amount: u64,
    pub kwh: u64,
}

#[event]
pub struct EnergyPurchased {
    pub resident: Pubkey,
    pub amount: u64,
}

// Errors
#[error_code]
pub enum EnergyGridError {
    #[msg("Only the community owner can perform this action")]
    Unauthorized,
    #[msg("This resident is not a producer")]
    NotAProducer,
    #[msg("This resident is not a consumer")]
    NotAConsumer,
    #[msg("Insufficient energy token balance")]
    InsufficientBalance,
}
