use std::str::FromStr;

use anchor_lang::prelude::*;

use crate::{constants::AUTHORIZED_CALLER, events::{InitializeCharityEvent, InitializeReferralEvent}, state::ReferralAccount};

#[derive(Accounts)]
#[instruction(referral_code: String)]
pub struct InitReferral<'info> {
    #[account(
        mut,
        address = AUTHORIZED_CALLER
    )]
    pub authorized_caller: Signer<'info>,

    #[account(
        init,
        payer = authorized_caller,
        space = ReferralAccount::INIT_SPACE + 8,
        seeds = [b"referral", referral_code.as_bytes()],
        bump
    )]
    pub referral: Account<'info, ReferralAccount>,

    pub system_program: Program<'info, System>
}

impl<'info> InitReferral<'info> {
    pub fn init_referral(&mut self, name: String, referral_code: String, bumps: &InitReferralBumps) -> Result<()> {

        self.referral.set_inner(ReferralAccount { 
            name, 
            referral_count: 0, 
            referral_code, 
            bump: bumps.referral
        });

        emit!(InitializeReferralEvent {
            name: self.referral.name.clone(),
            referral_code: self.referral.referral_code.clone()
        });

        Ok(())
    }
}