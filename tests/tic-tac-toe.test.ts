import {
  Program,
  workspace,
  Wallet,
  setProvider,
  AnchorProvider,
  AnchorError,
} from "@project-serum/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { assert, expect } from "chai";
import type { TicTacToe } from "../target/types/tic_tac_toe";

async function play(
  program: Program<TicTacToe>,
  game: PublicKey,
  player: any,
  tile: { row: number; column: number },
  expectedTurn: number,
  expectedGameState: any,
  expectedBoard: any
) {
  await program.methods
    .playGame(tile)
    .accounts({
      player: player.publicKey,
      game,
    })
    .signers(player instanceof (Wallet as any) ? [] : [player])
    .rpc();

  const gameState = await program.account.game.fetch(game);
  expect(gameState.turn).to.equal(expectedTurn);
  expect(gameState.state).to.eql(expectedGameState);
  expect(gameState.board).to.eql(expectedBoard);
}

describe("TicTacToe Program", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);
  const program = workspace.TicTacToe as Program<TicTacToe>;

  let playerOne: Wallet;
  let playerTwo: Keypair;
  let gameKeypair: Keypair;

  beforeEach(() => {
    gameKeypair = Keypair.generate();
    playerOne = provider.wallet as Wallet;
    playerTwo = Keypair.generate();
  });

  async function setupGame() {
    return program.methods
      .setupGame(playerTwo.publicKey)
      .accounts({
        game: gameKeypair.publicKey,
        playerOne: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();
  }

  it("should setup game", async () => {
    await setupGame();
    let gameState = await program.account.game.fetch(gameKeypair.publicKey);
    expect(gameState.turn).to.equal(1);
    expect(gameState.players).to.eql([
      playerOne.publicKey,
      playerTwo.publicKey,
    ]);
    expect(gameState.state).to.eql({ active: {} });
    expect(gameState.board).to.eql([
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
  });

  it("should play game and player one wins", async () => {
    await setupGame();
    await play(
      program,
      gameKeypair.publicKey,
      playerOne,
      { row: 0, column: 0 },
      2,
      { active: {} },
      [
        [{ x: {} }, null, null],
        [null, null, null],
        [null, null, null],
      ]
    );
  });

  it("should not play game when out of bounds row", async () => {
    try {
      await setupGame();
      await play(
        program,
        gameKeypair.publicKey,
        playerOne,
        { row: 0, column: 0 },
        2,
        { active: {} },
        [
          [{ x: {} }, null, null],
          [null, null, null],
          [null, null, null],
        ]
      );
      await play(
        program,
        gameKeypair.publicKey,
        playerTwo,
        { row: 5, column: 1 }, // ERROR: out of bounds row
        4,
        { active: {} },
        [
          [{ x: {} }, { x: {} }, null],
          [{ o: {} }, null, null],
          [null, null, null],
        ]
      );
      // we use this to make sure we definitely throw an error
      assert(false, "should've failed but didn't ");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err = _err as AnchorError;
      expect(err.error.errorCode.number).to.equal(6000);
    }
  });

  it("should not play game when same players", async () => {
    try {
      await setupGame();
      await play(
        program,
        gameKeypair.publicKey,
        playerOne,
        { row: 0, column: 0 },
        2,
        { active: {} },
        [
          [{ x: {} }, null, null],
          [null, null, null],
          [null, null, null],
        ]
      );
      await play(
        program,
        gameKeypair.publicKey,
        playerOne, // ERROR: same player in subsequent turns

        // change sth about the tx because
        // duplicate tx that come in too fast
        // after each other may get dropped
        { row: 1, column: 0 },
        2,
        { active: {} },
        [
          [{ x: {} }, null, null],
          [null, null, null],
          [null, null, null],
        ]
      );
      assert(false, "should've failed but didn't ");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err = _err as AnchorError;
      expect(err.error.errorCode.code).to.equal("NotPlayersTurn");
      expect(err.error.errorCode.number).to.equal(6003);
      expect(err.program.equals(program.programId)).is.true;
      expect(err.error.comparedValues).to.deep.equal([
        playerTwo.publicKey,
        playerOne.publicKey,
      ]);
    }
  });
});
