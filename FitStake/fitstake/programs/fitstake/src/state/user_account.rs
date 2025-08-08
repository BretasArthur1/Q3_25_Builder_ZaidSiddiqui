use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    #[max_len(32)]
    pub first_name: String,
    #[max_len(32)]
    pub last_name: String,
    pub wallet: Pubkey,
    pub date_of_birth: i64,
    pub bump: u8
}