use crate::errors::TicTacToeError;
use crate::state::*;
use anchor_lang::prelude::*;

pub fn play_game(ctx: Context<PlayGame>, tile: Tile) -> Result<()> {
    let game = &mut ctx.accounts.game;
    require_keys_eq!(
        game.current_player(),
        ctx.accounts.player.key(),
        TicTacToeError::NotPlayersTurn
    );
    game.play(&tile)
}

#[derive(Accounts)]
pub struct PlayGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,
    pub player: Signer<'info>,
}
