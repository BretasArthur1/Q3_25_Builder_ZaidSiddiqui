#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;

declare_id!("EEi741VXbkmZ7i6Yd79aaJSE4K3qUFUCJthLrdqNFmZ2");

mod state;
mod instructions;
mod errors;
mod events;
mod constants;

use instructions::*;
use errors::*;

#[program]
pub mod fitstake {
    use super::*;

    pub fn init_user(ctx: Context<InitUser>, first_name: String, last_name: String, wallet: Pubkey, date_of_birth: i64, referral_code: Option<String>) -> Result<()> {
        ctx.accounts.init_user(first_name, last_name, wallet, date_of_birth, &ctx.bumps)?;
        if let (Some(ref_account), Some(code)) = (&ctx.accounts.referral, referral_code) {
            // derive the PDA manually
            let (expected_pda, _) = Pubkey::find_program_address(
            &[b"referral", code.as_bytes()],
            ctx.program_id
            );
            require_keys_eq!(ref_account.key(), expected_pda, FitStakeError::InvalidReferral);

            ctx.accounts.increment_referral_count()?;
        }

        Ok(())
    }

    pub fn init_goal(ctx: Context<InitGoal>, seed: u64, stake_amount: u64, deadline: i64, charity: Pubkey, details: String) -> Result<()> {
        ctx.accounts.init_goal(seed, stake_amount, deadline, charity, details, &ctx.bumps)?;
        ctx.accounts.deposit_stake()
    }

    pub fn complete_goal(ctx: Context<CompleteGoal>) -> Result<()> {
        ctx.accounts.claim_stake()?;
        ctx.accounts.mark_complete()
    }

    pub fn forfeit_goal(ctx: Context<ForfeitGoal>) -> Result<()> {
        ctx.accounts.forfeit_stake()?;
        ctx.accounts.mark_forfeited()
    }

    pub fn init_charity(ctx: Context<InitCharity>, name: String, description: String, logo: String) -> Result<()> {
        ctx.accounts.init_charity(name, description, logo, &ctx.bumps)
    }

    pub fn init_referral(ctx: Context<InitReferral>, name: String, referral_code: String) -> Result<()> {
        ctx.accounts.init_referral(name, referral_code, &ctx.bumps)
    }
}
