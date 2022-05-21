import {
  Program,
  workspace,
  setProvider,
  AnchorProvider,
  Wallet,
  BN,
  AnchorError,
} from "@project-serum/anchor";
import {
  createAccount,
  createMint,
  createMintToCheckedInstruction,
  createSyncNativeInstruction,
  getAccount,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { expect } from "chai";
import type { Escrow } from "../target/types/escrow";
import { formatAnchorError, getAnchorError } from "./utils";

const X_TOKEN_DECIMALS = 3;
const AIRDROP_AMOUNT = 2 * LAMPORTS_PER_SOL;

describe("Escrow Program", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);
  const {
    account,
    methods,
    programId,
    idl: { errors },
  } = workspace.Escrow as Program<Escrow>;
  const { connection, wallet } = provider;

  let bump: number;
  let escrow: PublicKey;
  let escrowTokenAccount: PublicKey;
  let maker: Wallet;
  let makerAmount: BN;
  let makerReceiveTokenAccount: PublicKey;
  let makerSendTokenAccount: PublicKey;
  let taker: Keypair;
  let takerAmount: BN;
  let takerReceiveTokenAccount: PublicKey;
  let takerSendTokenAccount: PublicKey;
  let xToken: PublicKey;
  let yToken: PublicKey;
  beforeEach(async () => {
    maker = wallet as Wallet;
    makerAmount = new BN(100 * 10 ** X_TOKEN_DECIMALS);
    taker = Keypair.generate();
    await airdrop(taker.publicKey);
    takerAmount = new BN(LAMPORTS_PER_SOL);
    xToken = await createMint(
      connection,
      maker.payer,
      maker.publicKey,
      null,
      X_TOKEN_DECIMALS
    );
    yToken = NATIVE_MINT;
    [
      makerReceiveTokenAccount,
      makerSendTokenAccount,
      escrowTokenAccount,
      takerReceiveTokenAccount,
      takerSendTokenAccount,
    ] = await Promise.all([
      createTokenAccount(maker.payer, yToken),
      createTokenAccount(maker.payer, xToken),
      createTokenAccount(maker.payer, xToken),
      createTokenAccount(taker, xToken),
      createTokenAccount(taker, yToken),
    ]);
    [escrow, bump] = await PublicKey.findProgramAddress(
      [
        escrowTokenAccount.toBuffer(),
        maker.publicKey.toBuffer(),
        takerAmount.toBuffer("le", 8),
      ],
      programId
    );
    await Promise.all([fundEscrowTokenAccount(), fundTakerSendTokenAccount()]);
  });

  async function airdrop(to: PublicKey) {
    const signature = await connection.requestAirdrop(to, AIRDROP_AMOUNT);
    await connection.confirmTransaction(signature);
  }

  function fundEscrowTokenAccount() {
    const transaction = new Transaction().add(
      createMintToCheckedInstruction(
        xToken,
        escrowTokenAccount,
        maker.publicKey,
        makerAmount.toNumber(),
        X_TOKEN_DECIMALS
      )
    );
    return provider.sendAndConfirm(transaction);
  }

  function fundTakerSendTokenAccount() {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: takerSendTokenAccount,
        lamports: takerAmount.toNumber(),
      }),
      createSyncNativeInstruction(takerSendTokenAccount)
    );
    return provider.sendAndConfirm(transaction);
  }

  function cancelOrder() {
    return methods
      .cancelOrder()
      .accounts({
        escrow,
        escrowTokenAccount,
        maker: maker.publicKey,
        makerSendTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  function makeOrder() {
    return methods
      .makeOrder(takerAmount)
      .accounts({
        escrow,
        escrowTokenAccount,
        maker: maker.publicKey,
        makerReceiveTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  async function takeOrder() {
    return methods
      .takeOrder(makerAmount)
      .accounts({
        escrow,
        escrowTokenAccount,
        maker: maker.publicKey,
        makerReceiveTokenAccount,
        taker: taker.publicKey,
        takerReceiveTokenAccount,
        takerSendTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([taker])
      .rpc();
  }

  function getEscrow() {
    return account.escrow.fetchNullable(escrow);
  }

  function createTokenAccount(payer: Keypair, mint: PublicKey) {
    return createAccount(
      connection,
      payer,
      mint,
      payer.publicKey,
      Keypair.generate()
    );
  }

  it("should cancel order if valid inputs", async () => {
    await makeOrder();
    await cancelOrder();
    const escrowInfo = await getEscrow();
    const escrowTokenAccountInfo = await connection.getAccountInfo(
      escrowTokenAccount
    );
    const makerSendTokenAccountInfo = await getAccount(
      connection,
      makerSendTokenAccount
    );

    expect(escrowInfo).to.be.null;
    expect(escrowTokenAccountInfo).to.be.null;
    expect(Number(makerSendTokenAccountInfo.amount)).to.be.equal(
      makerAmount.toNumber()
    );
  });

  it("should not cancel order if escrowTokenAccount mismatched", async () => {
    try {
      await makeOrder();
      escrowTokenAccount = takerReceiveTokenAccount;
      await takeOrder();
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(getAnchorError("ConstraintSeeds")).to.include(
        formatAnchorError(err as AnchorError)
      );
    }
  });

  it("should not cancel order if maker mismatched", async () => {
    try {
      await makeOrder();
      maker = new Wallet(Keypair.generate());
      await takeOrder();
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(getAnchorError("ConstraintSeeds")).to.include(
        formatAnchorError(err as AnchorError)
      );
    }
  });

  it("should make order if valid inputs", async () => {
    await makeOrder();
    const escrowInfo = (await getEscrow())!;
    const escrowTokenAccountInfo = await getAccount(
      connection,
      escrowTokenAccount
    );

    expect(escrowInfo.bump).to.be.equal(bump);
    expect(escrowInfo.isInitialized).to.be.true;
    expect(escrowInfo.maker.equals(maker.publicKey)).to.be.true;
    expect(escrowInfo.makerAmount.eq(makerAmount)).to.be.true;
    expect(escrowInfo.makerReceiveTokenAccount.equals(makerReceiveTokenAccount))
      .to.be.true;
    expect(escrowInfo.takerAmount.eq(takerAmount)).to.be.true;
    expect(escrowInfo.tokenAccount.equals(escrowTokenAccount)).to.be.true;
    expect(escrowTokenAccountInfo.owner.equals(escrow)).to.be.true;
    expect(Number(escrowTokenAccountInfo.amount)).to.be.equal(
      makerAmount.toNumber()
    );
  });

  it("should take order if valid inputs", async () => {
    await makeOrder();
    await takeOrder();
    const escrowInfo = await getEscrow();
    const escrowTokenAccountInfo = await connection.getAccountInfo(
      escrowTokenAccount
    );

    expect(escrowInfo).to.be.null;
    expect(escrowTokenAccountInfo).to.be.null;
  });

  it("should not take order if escrowTokenAccount mismatched", async () => {
    try {
      await makeOrder();
      escrowTokenAccount = takerReceiveTokenAccount;
      await takeOrder();
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(getAnchorError("ConstraintSeeds")).to.include(
        formatAnchorError(err as AnchorError)
      );
    }
  });

  it("should not take order if maker mismatched", async () => {
    try {
      await makeOrder();
      maker = new Wallet(Keypair.generate());
      await takeOrder();
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(getAnchorError("ConstraintSeeds")).to.include(
        formatAnchorError(err as AnchorError)
      );
    }
  });

  it("should not take order if makerAmount mismatched", async () => {
    try {
      await makeOrder();
      makerAmount = new BN(100);
      await takeOrder();
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(errors[1]).to.include(formatAnchorError(err as AnchorError));
    }
  });

  it("should not take order if makerRecieveTokenAccount mismatched", async () => {
    try {
      await makeOrder();
      makerReceiveTokenAccount = takerReceiveTokenAccount;
      await takeOrder();
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(errors[2]).to.include(formatAnchorError(err as AnchorError));
    }
  });
});
