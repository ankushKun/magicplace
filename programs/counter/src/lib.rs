use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};
use session_keys::{session_auth_or, Session, SessionError, SessionToken};

declare_id!("49NcALUBrB68LN1QpgfHB4G4TP6UJuyb7EG9QuwxcTVy");

#[ephemeral]
#[program]
pub mod counter {
    use super::*;

    /// Initialize a new counter account with count set to 0
    /// Uses PDA derivation with user's public key for deterministic addresses
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        counter.authority = ctx.accounts.authority.key();
        msg!(
            "PDA {} initialized with count: {}",
            counter.key(),
            counter.count
        );
        Ok(())
    }

    /// Increment the counter by 1
    /// Wraps around to 0 if count exceeds 1000 (for demo purposes)
    #[session_auth_or(
        ctx.accounts.counter.authority.key() == ctx.accounts.signer.key(),
        CounterError::InvalidAuth
    )]
    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = counter.count.checked_add(1).unwrap();
        if counter.count > 1000 {
            counter.count = 0;
        }
        msg!("PDA {} count: {}", counter.key(), counter.count);
        Ok(())
    }

    /// Decrement the counter by 1
    #[session_auth_or(
        ctx.accounts.counter.authority.key() == ctx.accounts.signer.key(),
        CounterError::InvalidAuth
    )]
    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        require!(counter.count > 0, CounterError::CounterUnderflow);
        counter.count = counter.count.checked_sub(1).unwrap();
        msg!("PDA {} count: {}", counter.key(), counter.count);
        Ok(())
    }

    /// Set the counter to a specific value
    #[session_auth_or(
        ctx.accounts.counter.authority.key() == ctx.accounts.signer.key(),
        CounterError::InvalidAuth
    )]
    pub fn set(ctx: Context<Update>, value: u64) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = value;
        msg!("PDA {} count: {}", counter.key(), counter.count);
        Ok(())
    }

    // ========================================
    // MagicBlock Ephemeral Rollups Functions
    // ========================================

    /// Delegate the counter account to the delegation program
    /// Optionally set a specific validator from the first remaining account
    /// See: https://docs.magicblock.gg/pages/get-started/how-integrate-your-program/local-setup
    pub fn delegate(ctx: Context<DelegateInput>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                // Optionally set a specific validator from the first remaining account
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Manual commit the counter account in the Ephemeral Rollup
    /// This persists the current state to the base layer
    pub fn commit(ctx: Context<CommitInput>) -> Result<()> {
        commit_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.counter.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Undelegate the counter account from the delegation program
    /// This commits and removes the account from the Ephemeral Rollup
    pub fn undelegate(ctx: Context<CommitInput>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.counter.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }
}

// ========================================
// Account Structs
// ========================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Counter::INIT_SPACE,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Session)]
pub struct Update<'info> {
    #[account(
        mut,
        seeds = [counter.authority.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, Counter>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[session(signer = signer, authority = counter.authority.key())]
    pub session_token: Option<Account<'info, SessionToken>>,
}

/// Account context for delegating the counter PDA
/// The #[delegate] macro adds necessary accounts for delegation
#[delegate]
#[derive(Accounts)]
pub struct DelegateInput<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The PDA to delegate - validated by seeds constraint
    #[account(mut, del, seeds = [payer.key().as_ref()], bump)]
    pub pda: AccountInfo<'info>,
}

/// Account context for commit and undelegate operations
/// The #[commit] macro adds magic_context and magic_program accounts
#[commit]
#[derive(Accounts)]
pub struct CommitInput<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, seeds = [payer.key().as_ref()], bump)]
    pub counter: Account<'info, Counter>,
}

// ========================================
// Account Data
// ========================================

#[account]
#[derive(InitSpace)]
pub struct Counter {
    /// The current count value
    pub count: u64,
    /// The authority who can update the counter
    pub authority: Pubkey,
}

// ========================================
// Errors
// ========================================

#[error_code]
pub enum CounterError {
    #[msg("Counter cannot go below zero")]
    CounterUnderflow,
    #[msg("Invalid authentication")]
    InvalidAuth,
}
