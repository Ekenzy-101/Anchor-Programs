use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Token};
use crate::state::Escrow;
use crate::errors::*;


#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
        mut,
        seeds = [escrow_token_account.key().as_ref(), maker.key().as_ref(), &escrow.taker_amount.to_le_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub maker_send_token_account: Account<'info, TokenAccount>,   
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(taker_amount: u64)]
pub struct MakeOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
        init, payer = maker, space = 8 + Escrow::LEN,
        seeds = [escrow_token_account.key().as_ref(), maker.key().as_ref(), &taker_amount.to_le_bytes()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub maker_receive_token_account: Account<'info, TokenAccount>,    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(maker_amount: u64)]
pub struct TakeOrder<'info> {
    #[account(
        mut,
        // This constraint will be used to validate escrow_token_account, maker
        seeds = [escrow_token_account.key().as_ref(), maker.key().as_ref(), &escrow.taker_amount.to_le_bytes()],
        bump = escrow.bump,
        constraint = escrow.maker_amount == maker_amount @EscrowError::ExpectedAmountMismatch,
        constraint = escrow.maker_receive_token_account == maker_receive_token_account.key() @EscrowError::InvalidAccountData
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    /// CHECK: We are only receiving SOL here
    pub maker: UncheckedAccount<'info>,
    #[account(mut)]
    pub maker_receive_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub taker_send_token_account: Account<'info, TokenAccount>,    
    #[account(mut)]
    pub taker_receive_token_account: Account<'info, TokenAccount>,        
    pub token_program: Program<'info, Token>,
}