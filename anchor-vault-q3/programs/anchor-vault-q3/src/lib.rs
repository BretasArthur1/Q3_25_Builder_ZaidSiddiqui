#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

declare_id!("J8BRYS7j32PyLFJ2uEenv6FC2yEVJdC8ZuVNi5kdu8EF");

#[program]
pub mod anchor_vault_q3 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(ctx.bumps)?;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account{
        init,
        payer = user,
        seeds = [b"state", user.key().as_ref()],
        bump,
        space = 8 + VaultState::INIT_SPACE
    }]
    pub vault_state: Account<'info, VaultState>,
    #[account{
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump,
    }]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(&mut self, bumps: InitializeBumps) -> Result<()> {
        let rent_exempt = Rent::get()?.minimum_balance(self.vault_state.to_account_info().data_len());

        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, rent_exempt)?;

        self.vault_state.vault_bump = bumps.vault;
        self.vault_state.state_bump = bumps.vault_state;

        Ok({})
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account{mut}]
    pub user: Signer<'info>,
    #[account{
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump,
    }]
    pub vault: SystemAccount<'info>,
    #[account{
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump,
    }]
    pub vault_state: Account<'info, VaultState>,
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, amount)?;

        Ok({})
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account{mut}]
    pub user: Signer<'info>,
    #[account{
        mut,
        seeds = [b"vault", vault_state.key().as_ref()],
        bump = vault_state.vault_bump,
    }]
    pub vault: SystemAccount<'info>,
    #[account{
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump,
    }]
    pub vault_state: Account<'info, VaultState>,
    pub system_program: Program<'info, System>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        // Check that the withdraw leaves the vault with a rent-exempt balance
        // Check the account has enough funds for the user to withdraw
        
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };

        let seeds = &[
            b"vault".as_ref(),
            self.vault_state.to_account_info().key.as_ref(),
            &[self.vault_state.vault_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    
        transfer(cpi_ctx, amount)?;

        Ok({})
    }
}

// Implement a context to close the account
// Tip: Look for a close constraint
// Don't forget to manually close the vault account
// Don't the withdraw and deposit context have the same accounts? Can't we just use the same context in different instructions?

#[account]
#[derive(InitSpace)] // This macro does not take into consideration the anchor discriminator size
pub struct VaultState {
    pub vault_bump: u8,
    pub state_bump: u8,
}

// impl Space for VaultState {
//     const INIT_SPACE: usize = 8 + 1 + 1;
// }