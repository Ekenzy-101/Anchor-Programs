use crate::errors::*;
use crate::instructions::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{ 
    CloseAccount, SetAuthority, Transfer, 
    close_account, set_authority, transfer, 
    spl_token::instruction::AuthorityType
};
mod  errors;
mod  state;
mod instructions;
declare_id!("G6A6Nt2iPp6rtZXhTonvtYZUzssETNhHvPBaF3KezG6v");

#[program]
pub mod escrow {
    use super::*;

    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        msg!("[Escrow] Calling the token program to transfer tokens back to the maker");
        let escrow = &ctx.accounts.escrow;
        let escrow_token_account = &ctx.accounts.escrow_token_account;
        let accounts = Transfer {
            authority: escrow.to_account_info(),
            from: escrow_token_account.to_account_info(),
            to: ctx.accounts.maker_send_token_account.to_account_info()
        };
        let program = ctx.accounts.token_program.to_account_info();
        let bump = &[escrow.bump];
        let taker_amount_bytes = &escrow.taker_amount.to_le_bytes();
        let seeds = &[escrow.token_account.as_ref(), escrow.maker.as_ref(), taker_amount_bytes, bump][..];
        let signer_seeds = &[seeds];
        transfer(CpiContext::new_with_signer(program, accounts, signer_seeds), escrow_token_account.amount)?;
        
        msg!("[Escrow] Calling the token program to close escrow's token account");
        let accounts = CloseAccount {
            authority: escrow.to_account_info(),
            account: escrow_token_account.to_account_info(),
            destination: ctx.accounts.maker.to_account_info(),
        };
        let program = ctx.accounts.token_program.to_account_info();
        close_account(CpiContext::new_with_signer(program, accounts, signer_seeds))?;

        msg!("[Escrow] Closing escrow account");
        let maker = &mut ctx.accounts.maker.to_account_info();
        let escrow_account = &mut ctx.accounts.escrow.to_account_info();
        **maker.lamports.borrow_mut() = maker.lamports().checked_add(escrow_account.lamports()).ok_or(EscrowError::AmountOverflow)?;
        **escrow_account.lamports.borrow_mut() = 0;
        escrow_account.data.borrow_mut().fill(0);        
        Ok(())
    }

    pub fn make_order(ctx: Context<MakeOrder>, taker_amount: u64) -> Result<()> {
        ctx.accounts.escrow.set_inner(Escrow { 
            bump: *ctx.bumps.get("escrow").unwrap(), 
            is_initialized: true, 
            maker: ctx.accounts.maker.key(), 
            maker_amount: ctx.accounts.escrow_token_account.amount, 
            maker_receive_token_account: ctx.accounts.maker_receive_token_account.key(), 
            taker_amount, 
            token_account: ctx.accounts.escrow_token_account.key() 
        });
        let accounts = SetAuthority {
            current_authority: ctx.accounts.maker.to_account_info(),
            account_or_mint: ctx.accounts.escrow_token_account.to_account_info(),
        };
        let program = ctx.accounts.token_program.to_account_info();
        let authority_type = AuthorityType::AccountOwner;
        let new_authority = Some(ctx.accounts.escrow.key());
        set_authority(CpiContext::new(program, accounts), authority_type, new_authority)?;
        Ok(())
    }
    
    pub fn take_order(ctx: Context<TakeOrder>, maker_amount: u64) -> Result<()> {
        msg!("[Escrow] Calling the token program to transfer tokens to the maker");
        let escrow = &ctx.accounts.escrow;
        let accounts = Transfer {
            authority: ctx.accounts.taker.to_account_info(),
            from: ctx.accounts.taker_send_token_account.to_account_info(),
            to: ctx.accounts.maker_receive_token_account.to_account_info()
        };
        let program = ctx.accounts.token_program.to_account_info();
        transfer(CpiContext::new(program, accounts), escrow.taker_amount)?;
        
        msg!("[Escrow] Calling the token program to transfer tokens to the taker");
        let accounts = Transfer {
            authority: escrow.to_account_info(),
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.taker_receive_token_account.to_account_info()
        };
        let program = ctx.accounts.token_program.to_account_info();
        let bump = &[escrow.bump];
        let taker_amount_bytes = &escrow.taker_amount.to_le_bytes();
        let seeds = &[escrow.token_account.as_ref(), escrow.maker.as_ref(), taker_amount_bytes, bump][..];
        let signer_seeds = &[seeds];
        transfer(CpiContext::new_with_signer(program, accounts, signer_seeds), maker_amount)?;

        msg!("[Escrow] Calling the token program to close escrow's token account");
        let accounts = CloseAccount {
            authority: escrow.to_account_info(),
            account: ctx.accounts.escrow_token_account.to_account_info(),
            destination: ctx.accounts.maker.to_account_info(),
        };
        let program = ctx.accounts.token_program.to_account_info();
        close_account(CpiContext::new_with_signer(program, accounts, signer_seeds))?;
        
        msg!("[Escrow] Closing escrow account");
        let maker = &mut ctx.accounts.maker.to_account_info();
        let escrow_account = &mut ctx.accounts.escrow.to_account_info();
        **maker.lamports.borrow_mut() = maker.lamports().checked_add(escrow_account.lamports()).ok_or(EscrowError::AmountOverflow)?;
        **escrow_account.lamports.borrow_mut() = 0;
        escrow_account.data.borrow_mut().fill(0);
        Ok(())
    }
}





