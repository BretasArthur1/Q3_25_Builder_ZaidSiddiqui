use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

use crate::{errors::FitStakeError, state::{GoalAccount, GoalStatus}};

#[derive(Accounts)]
pub struct CompleteGoal<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

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

        require!(now <= self.goal_account.deadline, FitStakeError::GoalDeadlinePassed); // checl deadline not passed
        require!(self.goal_account.status != GoalStatus::Complete, FitStakeError::GoalAlreadyCompleted); // check goal not already marked as complete
        require!(self.goal_account.status != GoalStatus::Forfeited, FitStakeError::GoalForfeited); // check goal not forfeited

        // Setup transfer CPI
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info()
        };
        let cpi_program = self.system_program.to_account_info();
        let seeds = &[b"vault", self.goal_account.to_account_info().key.as_ref(), &[self.goal_account.vault_bump]];
        let signer_seeds = &[&seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        // Transfer stake amount back to user
        transfer(cpi_ctx, self.goal_account.stake_amount)
    }

    pub fn mark_complete(&mut self) -> Result<()> {
        let goal_account = &mut self.goal_account;

        goal_account.status = GoalStatus::Complete;

        Ok(())
    }

}