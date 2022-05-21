use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    /// Amount overflowed by an operation.
    #[msg("Amount overflowed by an operation")]
    AmountOverflow,
    /// Expected amount does not match actual amount
    #[msg("Expected amount does not match actual amount")]
    ExpectedAmountMismatch,
    /// An account's data contents was invalid
    #[msg("An account's data contents was invalid")]
    InvalidAccountData,
}