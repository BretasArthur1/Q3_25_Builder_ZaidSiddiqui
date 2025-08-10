use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

use crate::{errors::FitStakeError, state::{GoalAccount, Status, UserAccount}};

#[derive(Accounts)]
pub struct CompleteGoal<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"user", user.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        seeds = [b"goal", user.key().as_ref(), goal_account.seed.to_le_bytes().as_ref()],
        bump
    )]
    pub goal_account: Account<'info, GoalAccount>,

    #[account(
        mut,
        seeds = [b"vault", goal_account.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>
}

impl<'info> CompleteGoal<'info> {
    pub fn claim_stake(&mut self) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require!(now <= self.goal_account.deadline, FitStakeError::GoalDeadlinePassed);

        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info()
        };

        let cpi_program = self.system_program.to_account_info();

        let seed = self.goal_account.seed.to_le_bytes();
        let seeds = &[b"goal", self.user.to_account_info().key.as_ref(), seed.as_ref()];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer(cpi_ctx, self.goal_account.stake_amount)
    }

    pub fn mark_compelete(&mut self) -> Result<()> {
        let goal_account = &mut self.goal_account;

        goal_account.status = Status::Complete;

        Ok(())
    }

}