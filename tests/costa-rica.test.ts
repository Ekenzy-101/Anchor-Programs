import {
  Program,
  workspace,
  setProvider,
  AnchorProvider,
  Wallet,
  AnchorError,
  BN,
} from "@project-serum/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert, expect } from "chai";
import type { CostaRica } from "../target/types/costa_rica";
import { formatAnchorError, mapKeysToUint8Array } from "./utils";

describe("Costa Rica Program", () => {
  const provider = AnchorProvider.env();
  setProvider(provider);
  const program = workspace.CostaRica as Program<CostaRica>;
  const { errors } = program.idl;
  const airdropAmount = 2 * LAMPORTS_PER_SOL;

  let account: PublicKey;
  let amount: BN;
  let bump: number;
  let authority: Wallet;
  let users: PublicKey[];
  let user: Keypair;
  beforeEach(async () => {
    authority = provider.wallet as Wallet;
    amount = new BN(LAMPORTS_PER_SOL);
    user = Keypair.generate();
    users = getUsers();
    [account, bump] = await PublicKey.findProgramAddress(
      [authority.publicKey.toBuffer(), mapKeysToUint8Array(users)],
      program.programId
    );
  });

  async function airdrop(to: PublicKey) {
    const { connection } = provider;
    const signature = await connection.requestAirdrop(to, airdropAmount);
    await connection.confirmTransaction(signature);
  }

  async function initialize() {
    await airdrop(authority.publicKey);
    return program.methods
      .initialize(users)
      .accounts({
        account,
        authority: authority.publicKey,
      })
      .rpc();
  }

  async function pay() {
    await airdrop(account);
    return program.methods
      .pay(amount)
      .accounts({
        account,
        user: user.publicKey,
        authority: authority.publicKey,
      })
      .rpc();
  }

  async function transfer() {
    await airdrop(user.publicKey);
    return program.methods
      .transfer(amount)
      .accounts({
        account,
        user: user.publicKey,
      })
      .signers([user])
      .rpc();
  }

  async function getAccountInfo() {
    return program.account.costaRica.fetch(account);
  }

  async function getBalance() {
    return provider.connection.getBalance(account);
  }

  function getUsers() {
    return Array.from<PublicKey>({ length: 2 }).fill(user.publicKey);
  }

  it("should initialize account if valid authority", async () => {
    await initialize();
    const accountInfo = await getAccountInfo();

    expect(accountInfo.authority.equals(authority.publicKey)).to.be.true;
    expect(accountInfo.bump).to.be.eql(bump);
    expect(accountInfo.users).to.be.eql(users);
  });

  it("should transfer to account if valid user and his account balance", async () => {
    await initialize();
    const formerBalance = await getBalance();
    await transfer();
    const balance = await getBalance();
    expect(balance).to.be.eql(formerBalance + amount.toNumber());
  });

  it("should not transfer to account if not initialized with user's wallet", async () => {
    try {
      await initialize();
      user = Keypair.generate();
      await transfer();
      assert(false, "should've failed but didn't");
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(errors[1]).to.include(formatAnchorError(err as AnchorError));
    }
  });

  it("should not transfer to account if user's wallet balance is less than amount", async () => {
    try {
      await initialize();
      amount = new BN(3 * LAMPORTS_PER_SOL);
      await transfer();
      assert(false, "should've failed but didn't");
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(errors[2]).to.include(formatAnchorError(err as AnchorError));
    }
  });

  it("should pay to user if valid authority, user and PDA account balance", async () => {
    await initialize();
    const formerBalance = await getBalance();
    await pay();
    const balance = await getBalance();
    expect(formerBalance + airdropAmount).to.be.eql(
      balance + amount.toNumber()
    );
  });

  it("should not pay to user if not initialized with user's wallet", async () => {
    try {
      await initialize();
      user = Keypair.generate();
      await pay();
      assert(false, "should've failed but didn't");
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(errors[1]).to.include(formatAnchorError(err as AnchorError));
    }
  });

  it("should not pay to user if account's wallet balance is less than amount", async () => {
    try {
      await initialize();
      amount = new BN(3 * LAMPORTS_PER_SOL);
      await pay();
      assert(false, "should've failed but didn't");
    } catch (err) {
      expect(err).to.be.instanceOf(AnchorError);
      expect(errors[2]).to.include(formatAnchorError(err as AnchorError));
    }
  });
});
