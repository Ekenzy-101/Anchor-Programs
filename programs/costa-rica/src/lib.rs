use crate::errors::*;
use anchor_lang::prelude::*;
use std::str::FromStr;
use anchor_lang::system_program;
mod errors;

declare_id!("Fonzsf9TYwye6VEHYhWLMTiZRt1sJY212ekoXB9rZogJ");

fn authority_keys() -> Vec<Pubkey> {
    vec![Pubkey::from_str("A6oDrkSq3trXovf3Q74Nui1UqghsdrRaHDhq9DuKqKWQ").unwrap()]
}

#[program]
pub mod costa_rica {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, users: [Pubkey; 2]) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        require!(
            authority_keys().contains(&authority),
            AppError::ForbiddenAuthority
        );
        ctx.accounts
            .account
            .set_inner(CostaRica { authority, bump: *ctx.bumps.get("account").unwrap(), users });
        Ok(())
    }

    pub fn transfer(ctx: Context<Transfer>, lamports: u64) -> Result<()> {
        let accounts = system_program::Transfer { 
            from: ctx.accounts.user.to_account_info(),  
            to: ctx.accounts.account.to_account_info(), 
        };
        require!(
            accounts.from.lamports() > lamports,
            AppError::AccountLamportsTooSmall
        );
        let program = ctx.accounts.system_program.to_account_info();
        system_program::transfer(CpiContext::new(program, accounts), lamports)?;        
        Ok(())
    }

    pub fn pay(ctx: Context<Pay>, lamports: u64) -> Result<()> {
        let account = ctx.accounts.account.to_account_info();
        let user = ctx.accounts.user.to_account_info();  
        require!(
            account.lamports() > lamports,
            AppError::AccountLamportsTooSmall
        );

        **user.try_borrow_mut_lamports()? = user
            .lamports()
            .checked_add(lamports)
            .ok_or(AppError::AmountOverflow)?;
        **account.try_borrow_mut_lamports()? -= lamports;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(users: [Pubkey; 2])]
pub struct Initialize<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + CostaRica::MAX_SIZE, 
        seeds = [authority.key.as_ref(), &users.iter().map(|p| {&p.as_ref()[0..16]}).collect::<Vec<_>>().concat()[..]],
        bump 
    )]
    pub account: Account<'info, CostaRica>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Pay<'info> {
    #[account(
        mut, has_one = authority @AppError::ForbiddenAuthority, 
        constraint = account.users.contains(user.key) @AppError::ForbiddenUser,
        seeds = [account.authority.as_ref(), &account.users.iter().map(|p| {&p.as_ref()[0..16]}).collect::<Vec<_>>().concat()[..]],
        bump = account.bump
    )]
    pub account: Account<'info, CostaRica>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Only used to recieve token
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(
        mut, constraint = account.users.contains(user.key) @AppError::ForbiddenUser,
        seeds = [account.authority.as_ref(), &account.users.iter().map(|p| {&p.as_ref()[0..16]}).collect::<Vec<_>>().concat()[..]],
        bump = account.bump
    )]
    pub account: Account<'info, CostaRica>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CostaRica {
    pub authority: Pubkey,
    pub bump: u8,
    pub users: [Pubkey; 2],
}

impl CostaRica {
    pub const MAX_SIZE: usize = 32 + 1 + (32 * 2);
}
