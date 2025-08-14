use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ReferralAccount {
    #[max_len(30)]
    pub name: String,
    pub referral_count: u64,
    #[max_len(8)]
    pub referral_code: String,
    pub bump: u8,
}