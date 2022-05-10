use anchor_lang::prelude::*;

#[error_code]
pub enum AppError {
    /// This authority was not allowed to perform this operation
    #[msg("This authority was not allowed to perform this operation")]
    ForbiddenAuthority,
    /// This user was not allowed to perform this operation
    #[msg("This user was not allowed to perform this operation")]
    ForbiddenUser,
    /// An account's lamports was too small
    #[msg("An account's lamports was too small")]
    AccountLamportsTooSmall,
    /// Amount overflowed by an operation.
    #[msg("Amount overflowed by an operation")]
    AmountOverflow,
}
