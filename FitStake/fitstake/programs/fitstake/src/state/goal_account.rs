use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GoalAccount {
    pub seed: u64,
    pub stake_amount: u64,
    pub deadline: i64,
    pub status: Status,
    pub charity: Pubkey,
    #[max_len(200)]
    pub details: String,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
#[repr(u8)]
pub enum Status {
    Incomplete = 0,
    Complete = 1,
    Forfeited = 2,
}
