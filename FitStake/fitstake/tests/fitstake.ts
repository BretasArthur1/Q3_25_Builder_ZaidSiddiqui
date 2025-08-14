import fs from "fs";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fitstake } from "../target/types/fitstake";
import { assert } from "chai";
import { Keypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { generateKeyPair } from "crypto";

describe("fitstake", () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.Fitstake as Program<Fitstake>;

  const secretKeyPath = path.resolve(__dirname, "./caller-wallet.json");
  const secretKeyString = fs.readFileSync(secretKeyPath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));

  // Test wallets
  // const programAuthority = provider.wallet.payer as anchor.web3.Keypair;
  const caller = Keypair.fromSecretKey(secretKey);
  const bob = anchor.web3.Keypair.generate();
  const lee = anchor.web3.Keypair.generate();
  const jack = anchor.web3.Keypair.generate();
  const charity = anchor.web3.Keypair.generate();

  // PDAs
  const getUserPda = (wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.toBuffer()],
      program.programId
    );

  const getGoalPda = (wallet: PublicKey, seed: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("goal"), wallet.toBuffer(), new anchor.BN(seed).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

  const getVaultPda = (goal: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), goal.toBuffer()],
      program.programId
    );

  before(async () => {
    // Fund test wallets
    for (let k of [bob, lee, jack, caller]) {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(k.publicKey, 10 * LAMPORTS_PER_SOL),
        "confirmed"
      );
    }
  });

  it("Initialize Bob's account", async () => {
    // Define data
    const [bobPda] = getUserPda(bob.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Bob";
    const last_name = "Smith";
    const wallet = bob.publicKey;

    // Perform transaction
    let txSig = await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp))
      .accounts({
        authorizedCaller: caller.publicKey,
        user: bob.publicKey,
        userAccount: bobPda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    
    // Ensure data on chain is correct
    const userAccountData = await program.account.userAccount.fetch(bobPda);

    assert.strictEqual(userAccountData.firstName.toString(), first_name, "First name doesn't match");
    assert.strictEqual(userAccountData.lastName.toString(), last_name, "Last name doesn't match");
    assert.strictEqual(userAccountData.wallet.toBase58(), wallet.toBase58(), "Wallet doesn't match");
    assert.strictEqual(userAccountData.dateOfBirth.toString(), new anchor.BN(timestamp).toString(), "Date of birth doesn't match");

    // Check event was emitted
    const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    const events = eventParser.parseLogs(tx.meta.logMessages);
    let logsEmitted = false;

    // Verify event info is correct
    for (let event of events) {
      if (event.name === "initializeUserEvent") {
        logsEmitted = true;
        assert.strictEqual(event.data.wallet.toString(), wallet.toString(), "Event wallet should match Bob's wallet");
      }
    }
    assert.isTrue(logsEmitted, "InitializeUserEvent should have been emitted");
  });

  it("Initialize Lee's account", async () => {
    // Define data
    const [leePda] = getUserPda(lee.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Lee";
    const last_name = "Jack";
    const wallet = lee.publicKey;

    // Perform transaction
    let txSig = await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp))
      .accounts({
        authorizedCaller: caller.publicKey,
        user: lee.publicKey,
        userAccount: leePda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    
    // Ensure data on chain is correct
    const userAccountData = await program.account.userAccount.fetch(leePda);

    assert.strictEqual(userAccountData.firstName.toString(), first_name, "First name doesn't match");
    assert.strictEqual(userAccountData.lastName.toString(), last_name, "Last name doesn't match");
    assert.strictEqual(userAccountData.wallet.toBase58(), wallet.toBase58(), "Wallet doesn't match");
    assert.strictEqual(userAccountData.dateOfBirth.toString(), new anchor.BN(timestamp).toString(), "Date of birth doesn't match");

    // Check event was emitted
    const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    const events = eventParser.parseLogs(tx.meta.logMessages);
    let logsEmitted = false;

    // Verify event info is correct
    for (let event of events) {
      if (event.name === "initializeUserEvent") {
        logsEmitted = true;
        assert.strictEqual(event.data.wallet.toString(), wallet.toString(), "Event wallet should match Lee's wallet");
      }
    }
    assert.isTrue(logsEmitted, "InitializeUserEvent should have been emitted");
  });

  it("Initialize Lee's account again (should fail)", async () => {
    // Define data
    const [leePda] = getUserPda(lee.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Lee";
    const last_name = "Jack";
    const wallet = lee.publicKey;

    // Perform transaction
    let flag = "This should fail";
    try {
      await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp))
      .accounts({
        authorizedCaller: caller.publicKey,
        user: lee.publicKey,
        userAccount: leePda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("already in use"), "Should fail with account already initialized error");
    }
    assert.strictEqual(flag, "Failed", "Reinitializing user account should fail");
  });

  it("Initialize Jack's account from incorrect caller (should fail)", async () => {
    // Define data
    const [jackPda] = getUserPda(jack.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Jack";
    const last_name = "Lee";
    const wallet = jack.publicKey;

    // Perform transaction
    let flag = "This should fail";
    try {
      await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp))
      .accounts({
        authorizedCaller: jack.publicKey,
        user: jack.publicKey,
        userAccount: jackPda,
        systemProgram: SystemProgram.programId
      })
      .signers([jack])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("address constraint was violated"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Incorrect caller signing should fail");
  });

  it("Bob creates a goal", async () => {
    // Define data
    const seed = 1;
    const stake_amount = 1_000_000;
    const date = new Date("2025-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    // const space = 8 + 8 + 8 + 1 + 32 + 4 + 200 + 1 + 1;
    // const rentExemptLamports = await provider.connection.getMinimumBalanceForRentExemption(space);

    // Get PDAs
    const [goalPda] = getGoalPda(bob.publicKey, seed);
    const [vaultPda] = getVaultPda(goalPda);
    const [userPda] = getUserPda(bob.publicKey);

    // Perform tx
    let txSig = await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charity.publicKey, details)
      .accounts({
        user: bob.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    // Ensure data on chain is correct
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);

    assert.strictEqual(goalAccountData.seed.toString(), seed.toString(), "Seed doesn't match");
    assert.strictEqual(goalAccountData.stakeAmount.toString(), stake_amount.toString(), "Stake amount doesn't match");
    assert.strictEqual(goalAccountData.charity.toString(), charity.publicKey.toString(), "Charity public key doesn't match");
    assert.strictEqual(goalAccountData.deadline.toString(), deadline.toString(), "Deadline doesn't match");
    assert.strictEqual(goalAccountData.details.toString(), details.toString(), "Details don't match");
    assert.isTrue('incomplete' in goalAccountData.status, "Status doesn't match");
    assert.strictEqual(goalAccountData.user.toString(), bob.publicKey.toString(), "User doesn't match");

    // Check event was emitted
    const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    const events = eventParser.parseLogs(tx.meta.logMessages);
    let initializeGoalEmitted = false;
    let depositStakeEmitted = false;

    // Verify event info is correct
    for (let event of events) {
      if (event.name === "initializeGoalEvent") {
        initializeGoalEmitted = true;
        assert.strictEqual(event.data.user.toString(), bob.publicKey.toString(), "Event user should match Bob's wallet");
        assert.strictEqual(event.data.seed.toString(), seed.toString(), "Event seed should match goal's seed");
        assert.strictEqual(event.data.deadline.toString(), deadline.toString(), "Event deadline should match goal's deadline");
        assert.strictEqual(event.data.charity.toString(), charity.publicKey.toString(), "Event charity should match goal's charity");
      }
      if (event.name === "depositStakeEvent") {
        depositStakeEmitted = true;
        assert.strictEqual(event.data.user.toString(), bob.publicKey.toString(), "Event user should match Bob's wallet");
        assert.strictEqual(event.data.amount.toString(), stake_amount.toString(), "Event stake amount should match goal's stake amount");
      }
    }
    assert.isTrue(initializeGoalEmitted, "InitializeGoalEvent should have been emitted");
    assert.isTrue(depositStakeEmitted, "DepositStakeEvent should have been emitted");
  });

  it("Lee creates a goal for Bob (should fail)", async () => {
    // Define data
    const seed = 1;
    const stake_amount = 500_000;
    const date = new Date("2025-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";

    // Get PDAs
    const [goalPda] = getGoalPda(bob.publicKey, seed);
    const [vaultPda] = getVaultPda(goalPda);
    const [userPda] = getUserPda(bob.publicKey);

    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charity.publicKey, details)
      .accounts({
        user: lee.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([lee])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("seeds constraint was violated"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Incorrect caller signing should fail");
  });
});
