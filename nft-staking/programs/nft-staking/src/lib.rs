#![allow(unexpected_cfgs, deprecated)]

use anchor_lang::prelude::*;

mod state;
mod instructions;

declare_id!("EEfTCAFozgqoeXVxGgwvVsLyR7fReqE3Z4UsP3JFQVg4");

#[program]
pub mod nft_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
