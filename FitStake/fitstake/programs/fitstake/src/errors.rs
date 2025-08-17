use anchor_lang::error_code;

#[error_code]
pub enum FitStakeError {
    #[msg("Default error")]
    DefaultError,

    #[msg("Arithmetic error occured")]
    ArithmeticError,

    #[msg("Insufficient funds to create goal")]
    InsufficientFunds,

    #[msg("Staking zero lamports not allowed")]
    StakingZeroLamports,

    #[msg("Goal deadline not yet passed")]
    GoalDeadlineNotPassed,

    #[msg("Deadline for goal has passed")]
    GoalDeadlinePassed,

    #[msg("Goal already completed")]
    GoalAlreadyCompleted,

    #[msg("Goal is already forfeited")]
    GoalForfeited,

    #[msg("User is not authority of this goal")]
    UserNotAuthority,

    #[msg("Invalid referral code provided")]
    InvalidReferral,
}