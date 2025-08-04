use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};

use crate::state::Bet;


#[derive(Accounts)]
#[instruction(seed: u128)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    /// CHECK: it's safe because it is checked somewhere else
    pub house: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault", house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        init,
        payer = player,
        seeds = [b"bet", vault.key().as_ref(), seed.to_le_bytes().as_ref()],
        bump,
        space = Bet::INIT_SPACE + 8
    )]
    pub bet: Account<'info, Bet>,

    pub system_program: Program<'info, System>,
}

impl<'info> PlaceBet<'info> {
    pub fn create_bet(&mut self, bumps: &PlaceBetBumps, seed: u128, roll: u8, amount: u64) -> Result<()> {

        self.bet.set_inner(Bet { 
            player: self.player.key(), 
            seed, 
            slot: Clock::get()?.slot, 
            amount, 
            roll, 
            bump: bumps.bet 
        });

        Ok(())
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let accounts = Transfer {
            from: self.player.to_account_info(),
            to: self.vault.to_account_info()
        };

        let ctx = CpiContext::new(
            self.system_program.to_account_info(), 
            accounts
        );

        transfer(ctx, amount)
    }
}