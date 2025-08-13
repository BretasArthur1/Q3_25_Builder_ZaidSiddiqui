use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

use crate::{constants::*, errors::FitStakeError, events::ForfeitStakeEvent, state::{GoalAccount, GoalStatus}};

#[derive(Accounts)]
pub struct ForfeitGoal<'info> {
    #[account(
        address = AUTHORIZED_CALLER
    )]
    pub authorized_caller: Signer<'info>,

    pub goal_account: Account<'info, GoalAccount>,

    #[account(
        mut,
        seeds = [b"vault", goal_account.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub charity_vault: SystemAccount<'info>,

    #[account(
        seeds = [b"fitstake", b"program", b"vault"],
        bump
    )]
    pub program_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>
}

impl<'info> ForfeitGoal<'info> {
    pub fn forfeit_stake(&mut self) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        require!(now >= self.goal_account.deadline, FitStakeError::GoalDeadlineNotPassed); // require deadline to be passed
        require!(self.goal_account.status != GoalStatus::Complete, FitStakeError::GoalAlreadyCompleted); // require goal not completed
        require!(self.goal_account.status != GoalStatus::Forfeited, FitStakeError::GoalForfeited); // require goal not already forfeited

        // Safe integer math: compute fee and remainder
        let stake = self.goal_account.stake_amount;
        let mut fee = stake.checked_mul(STAKE_FEE).ok_or(FitStakeError::ArithmeticError)?;
        fee = fee.checked_div(1000u64).ok_or(FitStakeError::ArithmeticError)?;
        // let fee = ((stake as u128) * (STAKE_FEE as u128) / 1000u128) as u64;
        let remainder = stake.checked_sub(fee).ok_or(FitStakeError::ArithmeticError)?;
        require!(fee + remainder == self.goal_account.stake_amount, FitStakeError::ArithmeticError);

        // Define CPI variables
        let cpi_program = self.system_program.to_account_info();
        let seeds = &[b"vault", self.goal_account.to_account_info().key.as_ref(), &[self.goal_account.vault_bump]];
        let signer_seeds = &[&seeds[..]];

        // Setup transfer CPI to collect fee
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.program_vault.to_account_info()
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        // Transfer stake fee to program vault
        transfer(cpi_ctx, fee)?;

        // Setup transfer CPI to forfeit stake
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.charity_vault.to_account_info()
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        // Transfer stake fee to program vault
        transfer(cpi_ctx, remainder)?;

        emit!(ForfeitStakeEvent {
            user: self.goal_account.user,
            now,
            deadline: self.goal_account.deadline,
            stake: self.goal_account.stake_amount,
            fee,
            amount: remainder,
            charity: self.charity_vault.key(),
            status: self.goal_account.status,
        });

        Ok(())
    }

    pub fn mark_forfeited(&mut self) -> Result<()> {
        let goal_account = &mut self.goal_account;

        goal_account.status = GoalStatus::Forfeited;

        Ok(())
    }
}