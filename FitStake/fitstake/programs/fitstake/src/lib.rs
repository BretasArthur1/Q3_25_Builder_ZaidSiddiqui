#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;

declare_id!("EEi741VXbkmZ7i6Yd79aaJSE4K3qUFUCJthLrdqNFmZ2");

mod state;
mod instructions;

use instructions::*;

#[program]
pub mod fitstake {
    use super::*;

    pub fn init_user(ctx: Context<InitUser>, first_name: String, last_name: String, wallet: Pubkey, date_of_birth: i64) -> Result<()> {
        ctx.accounts.init_user(first_name, last_name, wallet, date_of_birth, &ctx.bumps)
    }
}
