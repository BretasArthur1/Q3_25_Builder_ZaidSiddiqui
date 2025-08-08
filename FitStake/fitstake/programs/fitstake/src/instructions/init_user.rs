use anchor_lang::prelude::*;

use crate::state::UserAccount;

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub program: Signer<'info>,

    #[account(mut)]
    pub user: SystemAccount<'info>,

    #[account(
        init,
        payer = program,
        space = UserAccount::INIT_SPACE + 8,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>
}

impl<'info> InitUser<'info> {
    pub fn init_user(&mut self, first_name: String, last_name: String, wallet: Pubkey, date_of_birth: i64, bumps: &InitUserBumps) -> Result<()> {

        self.user_account.set_inner(UserAccount { 
            first_name, 
            last_name, 
            wallet, 
            date_of_birth, 
            bump: bumps.user_account
        });

        Ok(())
    }
}