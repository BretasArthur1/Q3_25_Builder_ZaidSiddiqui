use anchor_lang::prelude::*;

use crate::state::GoalStatus;

#[event]
pub struct InitializeUserEvent {
    pub wallet: Pubkey,
}

#[event]
pub struct InitializeGoalEvent {
    pub user: Pubkey,
    pub seed: u64,
    pub deadline: i64,
    pub charity: Pubkey,
}

#[event]
pub struct DepositStakeEvent {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ClaimStakeEvent {
    pub user: Pubkey,
    pub goal_authority: Pubkey,
    pub amount: u64,
    pub now: i64,
    pub deadline: i64,
    pub status: GoalStatus
}

#[event]
pub struct ForfeitStakeEvent {
    pub user: Pubkey,
    pub now: i64,
    pub deadline: i64,
    pub stake: u64,
    pub fee: u64,
    pub amount: u64,
    pub charity: Pubkey,
    pub status: GoalStatus
}