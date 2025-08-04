use anchor_lang::{prelude::*, system_program::{transfer, Transfer}};
use anchor_instruction_sysvar::Ed25519InstructionSignatures;
use solana_program::{
    sysvar::instructions::load_instruction_at_checked,
    ed25519_program,
    hash::hash
};

use crate::{state::Bet};

pub const HOUSE_EDGE: u16 = 150; // 1.5% basis points

#[derive(Accounts)]
pub struct ResolveBet<'info> {
    pub house: Signer<'info>,

    #[account(mut)]
    pub player: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault", house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        close = player,
        seeds = [b"bet", vault.key().as_ref(), bet.seed.to_le_bytes().as_ref()],
        bump,
    )]
    pub bet: Account<'info, Bet>,

    pub instruction_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>
}

impl<'info> ResolveBet<'info> {
    // Verify completely that the house is the only one calling these functions
    pub fn verify_ed25519_signature(&mut self, sig: &[u8]) -> Result<()> {
        let ix = load_instruction_at_checked(
            0, 
            &self.instruction_sysvar.to_account_info()
        )?;

        require_keys_eq!(ix.program_id, ed25519_program::ID, Error); // instruction references the correct program
        require_eq!(ix.accounts.len(), 0, Error); // instruction does not reference any extra accounts

        let signatures = Ed25519InstructionSignatures::unpack(&ix.data)?.0;

        require_eq!(signatures.len(), 1, Error); // only one signature passed

        let signature = &signatures[0];

        require!(signature.is_verifiable, Error); // all information in header is verifiable
        require_keys_eq!(signature.public_key.ok_or(Error)?, self.house.key(), Error); // verify house is the signer
        require!(&signature.signature.ok_or(Error)?.eq(signature), Error); // retreived signature is the same as signature in ix
        require!(&signature.message.ok_or(Error)?.eq(self.bet.to_slice()), Error); // verify message is the same as what we have

        Ok(())
    }

    pub fn resolve_bet(&mut self, bumps: ResolveBetBumps, sig: &[u8]) -> Result<()> {
        let hash = hash(sig).to_bytes();

        let mut hash_16: [u8; 16] = [0;16];

        hash_16.copy_from_slice(&hash[..16]);
        let lower = u128::from_be_bytes(hash_16);
        hash_16.copy_from_slice(&hash[16..]);
        let upper = u128::from_be_bytes(hash_16);

        let roll = lower.wrapping_add(upper).wrapping_rem(100) as u8 + 1;

        // Calculate payout if user wins
        if self.bet.roll > roll {
            let payout = (self.bet.amount as u128)
                .checked_mul(10000 - HOUSE_EDGE as u128).ok_or(Error)?
                .checked_div(self.bet.roll as u128 - 1).ok_or(Error)?
                .checked_div(100).ok_or(Error)?;

            let accounts = Transfer {
                from: self.vault.to_account_info(),
                to: self.player.to_account_info()
            };

            let seeds = [b"vault", &self.house.key().to_bytes()[..], &[bumps.vault]];
            let signer_seeds = &[&seeds[..]];

            let ctx = CpiContext::new_with_signer(
            self.system_program.to_account_info(), 
                accounts,
                signer_seeds
            );

            transfer(ctx, payout);
        }

        Ok(())
    }
}