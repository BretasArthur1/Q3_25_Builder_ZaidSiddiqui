use anchor_lang::prelude::*;

declare_id!("EEi741VXbkmZ7i6Yd79aaJSE4K3qUFUCJthLrdqNFmZ2");

#[program]
pub mod fitstake {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
