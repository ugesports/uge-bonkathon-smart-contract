use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PrizeError {
    #[error("Account not initialized yet")]
    UninitializedAccount,

    #[error("PDA derived does not equal PDA passed in")]
    InvalidPDA,

    #[error("Account is not a winner")]
    NotWinner,

    #[error("Input data exceeds max length")]
    InvalidDataLength,

    #[error("Time is invalid")]
    InvalidTime,
}

impl From<PrizeError> for ProgramError {
    fn from(e: PrizeError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
