use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

use crate::{errors::FitStakeError, events::{DepositStakeEvent, InitializeGoalEvent}, state::{GoalAccount, GoalStatus, UserAccount}};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct InitGoal<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"user", user.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        init,
        payer = user,
        space = GoalAccount::INIT_SPACE + 8,
        seeds = [b"goal", user.key().as_ref(), seed.to_le_bytes().as_ref()],
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

impl<'info> InitGoal<'info> {
    pub fn init_goal(
        &mut self,
        seed: u64,
        stake_amount: u64,
        deadline: i64,
        charity: Pubkey,
        details: String,
        bumps: &InitGoalBumps
    ) -> Result<()> {

        // Require user has sufficient funds
        require!(self.user.lamports() > stake_amount, FitStakeError::InsufficientFunds);

        self.goal_account.set_inner(GoalAccount { 
            user: self.user.key(),
            seed, 
            stake_amount, 
            deadline, 
            status: GoalStatus::Incomplete, 
            charity, 
            details, 
            bump: bumps.goal_account, 
            vault_bump: bumps.vault 
        });

        emit!(InitializeGoalEvent {
            user: self.user.key(),
            seed,
            deadline,
            charity
        });

        Ok(())
    }

    pub fn deposit_stake(&mut self) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info()
        };

        let cpi_program = self.system_program.to_account_info();

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, self.goal_account.stake_amount)?;

        emit!(DepositStakeEvent {
            user: self.user.key(),
            amount: self.goal_account.stake_amount,
        });

        Ok(())
    }
}