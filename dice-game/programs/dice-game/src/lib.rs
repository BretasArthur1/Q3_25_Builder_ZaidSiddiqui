use anchor_lang::prelude::*;

declare_id!("4F7pBVHpm2JdtiVz5ERLSJrHvgsu89YMyj16ip7XGrEM");

#[program]
pub mod dice_game {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
