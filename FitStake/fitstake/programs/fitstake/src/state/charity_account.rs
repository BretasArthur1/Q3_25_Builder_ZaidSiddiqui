use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct CharityAccount {
    // TODO: Upload all data off-chain
    #[max_len(30)]
    pub name: String,
    #[max_len(200)]
    pub description: String,
    #[max_len(30)]
    pub logo: String,
    pub bump: u8,
    pub vault_bump: u8,
}