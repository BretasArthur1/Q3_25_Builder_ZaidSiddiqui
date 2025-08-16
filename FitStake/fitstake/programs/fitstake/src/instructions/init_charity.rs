use anchor_lang::prelude::*;

use crate::{constants::AUTHORIZED_CALLER, events::InitializeCharityEvent, state::CharityAccount};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitCharity<'info> {
    #[account(
        mut,
        address = AUTHORIZED_CALLER
    )]
    pub authorized_caller: Signer<'info>,

    #[account(
        init,
        payer = authorized_caller,
        space = CharityAccount::INIT_SPACE + 8,
        seeds = [b"charity", name.as_bytes()],
        bump
    )]
    pub charity: Account<'info, CharityAccount>,

    #[account(
        mut,
        seeds = [b"charity", b"vault", name.as_bytes()],
        bump
    )]
    pub charity_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>
}

impl<'info> InitCharity<'info> {
    pub fn init_charity(&mut self, name: String, description: String, logo: String, bumps: &InitCharityBumps) -> Result<()> {

        self.charity.set_inner(CharityAccount { 
            name, 
            description, 
            logo, 
            bump: bumps.charity, 
            vault_bump: bumps.charity_vault 
        });

        emit!(InitializeCharityEvent {
            name: self.charity.name.clone(),
            description: self.charity.description.clone(),
            logo: self.charity.logo.clone()
        });

        Ok(())
    }
}