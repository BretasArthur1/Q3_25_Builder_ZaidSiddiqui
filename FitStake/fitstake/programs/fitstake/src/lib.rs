#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;

declare_id!("EEi741VXbkmZ7i6Yd79aaJSE4K3qUFUCJthLrdqNFmZ2");

mod state;
mod instructions;
mod errors;

use instructions::*;
use state::*;

#[program]
pub mod fitstake {
    use super::*;

    pub fn init_user(ctx: Context<InitUser>, first_name: String, last_name: String, wallet: Pubkey, date_of_birth: i64) -> Result<()> {
        ctx.accounts.init_user(first_name, last_name, wallet, date_of_birth, &ctx.bumps)
    }

    pub fn init_goal(ctx: Context<InitGoal>, seed: u64, stake_amount: u64, deadline: i64, charity: Pubkey, details: String) -> Result<()> {
        // TODO: Handle error
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
}
