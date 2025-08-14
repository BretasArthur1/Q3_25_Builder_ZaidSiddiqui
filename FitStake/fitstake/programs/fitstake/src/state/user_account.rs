use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    // TODO: Shift unnecessary info off-chain
    #[max_len(32)]
    pub first_name: String,
    #[max_len(32)]
    pub last_name: String,
    pub wallet: Pubkey, // TODO: might not need to store the pubkey, TBD
    pub date_of_birth: i64,
    pub bump: u8
}