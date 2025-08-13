use anchor_lang::prelude::*;

use crate::{constants::AUTHORIZED_CALLER, events::InitializeUserEvent, state::UserAccount};

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(
        mut,
        address = AUTHORIZED_CALLER
    )]
    pub authorized_caller: Signer<'info>,

    pub user: SystemAccount<'info>,

    #[account(
        init,
        payer = authorized_caller,
        space = UserAccount::INIT_SPACE + 8,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>
}

impl<'info> InitUser<'info> {
    pub fn init_user(&mut self, first_name: String, last_name: String, wallet: Pubkey, date_of_birth: i64, bumps: &InitUserBumps) -> Result<()> {
        require_keys_eq!(self.user.key(), wallet);

        self.user_account.set_inner(UserAccount { 
            first_name, 
            last_name, 
            wallet, 
            date_of_birth, 
            bump: bumps.user_account
        });

        emit!(InitializeUserEvent {
            wallet,  
        });

        Ok(())
    }
}