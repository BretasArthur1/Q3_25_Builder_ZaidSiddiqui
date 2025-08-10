use anchor_lang::error_code;

#[error_code]
pub enum FitStakeError {
    #[msg("Default error")]
    DefaultError,

    #[msg("Deadline for goal has passed")]
    GoalDeadlinePassed,
}