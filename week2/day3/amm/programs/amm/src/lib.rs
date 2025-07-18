use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod error;

declare_id!("9nKYHCf3jf1ft72Rxm8N2faPUg1g7EMxEoy15D7NTRnm");

#[program]
pub mod amm {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
