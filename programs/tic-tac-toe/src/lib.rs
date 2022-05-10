use anchor_lang::prelude::*;
use instructions::*;
use state::*;

pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("EGi1AxWuWEjVx65mwm1KysjVAXJcBNhRka1PqcoXtTNB");

#[program]
pub mod tic_tac_toe {
    use super::*;

    pub fn setup_game(ctx: Context<SetupGame>, player_two: Pubkey) -> Result<()> {
        instructions::setup_game(ctx, player_two)
    }

    pub fn play_game(ctx: Context<PlayGame>, tile: Tile) -> Result<()> {
        instructions::play_game(ctx, tile)
    }
}
