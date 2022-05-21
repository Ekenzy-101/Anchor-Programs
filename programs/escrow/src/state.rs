use anchor_lang::prelude::*;
#[account]
pub struct Escrow {
    pub bump: u8,
    pub is_initialized: bool,
    pub maker: Pubkey,
    /// The amount of tokens the maker sends when making the order.
    /// This value is taken just for display purpose on the UI
    pub maker_amount: u64,
    /// The receiving token account that the maker owns
    pub maker_receive_token_account: Pubkey,
    /// The amount of tokens the taker is expected to send when the taking the order
    pub taker_amount: u64,
    /// The temporary token account created by the maker but later owned by the escrow
    pub token_account: Pubkey,
}

impl Escrow {
    pub const LEN: usize = 1 + 1 + 32 + 8 + 32 + 8 + 32;
}