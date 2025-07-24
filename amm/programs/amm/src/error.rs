use anchor_lang::error_code;
use constant_product_curve::CurveError;

#[error_code]
pub enum AmmError {
    #[msg("DefaultError")]
    DefaultError,
    #[msg("Pool locked")]
    PoolLocked,
    #[msg("Invalid amount of tokens")]
    InvalidAmount,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
}

impl From<CurveError> for AmmError {
    fn from(error: CurveError) -> AmmError {
        match error {
            CurveError::InvalidPrecision => AmmError::DefaultError,
            CurveError::InsufficientBalance => AmmError::DefaultError,
            CurveError::InvalidFeeAmount => AmmError::DefaultError,
            CurveError::Underflow => AmmError::DefaultError,
            CurveError::Overflow => AmmError::DefaultError,
            CurveError::ZeroBalance => AmmError::DefaultError,
            CurveError::SlippageLimitExceeded => AmmError::SlippageExceeded,
        }
    }
}