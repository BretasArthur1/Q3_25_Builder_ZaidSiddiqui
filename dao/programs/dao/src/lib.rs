use anchor_lang::prelude::*;

declare_id!("GNCP5C1EGurrPNTPPLiqxAVr2Cd8SqeqKE1LbBGoShwe");

#[program]
pub mod dao {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
