import fs from "fs";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fitstake } from "../target/types/fitstake";
import { assert } from "chai";
import { Keypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { generateKeyPair } from "crypto";
import { ref } from "process";

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
  const getUserPda = async (wallet: PublicKey) =>
    await PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.toBuffer()],
      program.programId
    );

  const getGoalPda = async (wallet: PublicKey, seed: number) =>
    await PublicKey.findProgramAddressSync(
      [Buffer.from("goal"), wallet.toBuffer(), new anchor.BN(seed).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

  const getVaultPda = async (goal: PublicKey) =>
    await PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), goal.toBuffer()],
      program.programId
    );

  const getReferralPda = async (code: String) =>
    await PublicKey.findProgramAddressSync(
      [Buffer.from("referral"), Buffer.from(code)],
      program.programId
    );

  const getCharityPda = async (name: String) =>
    await PublicKey.findProgramAddressSync(
      [Buffer.from("charity"), Buffer.from(name)],
      program.programId
    );

  const getCharityVaultPda = async (name: String) =>
    await PublicKey.findProgramAddressSync(
      [Buffer.from("charity"), Buffer.from("vault"), Buffer.from(name)],
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

  it("Initialize referral account", async () => {
    // Define data
    const code = "9KLE";
    const [referralPda] = await getReferralPda(code);
    const name = "Zaid";

    // Perform transaction
    let txSig = await program.methods
      .initReferral(name, code)
      .accounts({
        authorizedCaller: caller.publicKey,
        referral: referralPda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    
    // Ensure data on chain is correct
    const referralAccountData = await program.account.referralAccount.fetch(referralPda);

    assert.strictEqual(referralAccountData.name.toString(), name.toString(), "Name doesn't match");
    assert.strictEqual(referralAccountData.referralCode.toString(), code.toString(), "Referral code doesn't match");
    assert.strictEqual(referralAccountData.referralCount.toString(), new anchor.BN(0).toString(), "Referral count isn't 0");

    // Check event was emitted
    const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    const events = eventParser.parseLogs(tx.meta.logMessages);
    let logsEmitted = false;

    // Verify event info is correct
    for (let event of events) {
      if (event.name === "initializeReferralEvent") {
        logsEmitted = true;
        assert.strictEqual(event.data.name.toString(), name.toString(), "Event name doesn't match");
        assert.strictEqual(event.data.referralCode.toString(), code.toString(), "Event referral code doesn't match");
      }
    }
    assert.isTrue(logsEmitted, "InitializeReferralEvent should have been emitted");
  });

  it("Initialize referral account with incorrect signer (should fail)", async () => {
    // Define data
    const code = "9KLP";
    const [referralPda] = await getReferralPda(code);
    const name = "Jeff";

    // Perform transaction
    let flag = "This should fail";
    try {
      await program.methods
      .initReferral(name, code)
      .accounts({
        authorizedCaller: bob.publicKey,
        referral: referralPda,
        systemProgram: SystemProgram.programId
      })
      .signers([bob])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("address constraint was violated"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Incorrect caller signing should fail");
  });

  it("Initialize charity account", async () => {
    // Define data
    const name = "PCRF";
    const [charityPda] = await getCharityPda(name);
    const [charityVault] = await getCharityVaultPda(name);
    const description = "Palestine Children's Relief Fund";
    const logo = "placeholderfornow";

    // Perform transaction
    let txSig = await program.methods
      .initCharity(name, description, logo)
      .accounts({
        authorizedCaller: caller.publicKey,
        charity: charityPda,
        charityVault,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    
    // Ensure data on chain is correct
    const charityAccountData = await program.account.charityAccount.fetch(charityPda);
    const charityVaultData = await provider.connection.getAccountInfo(charityVault, "confirmed");
    if (!charityVaultData) {
      throw new Error("Vault account not found");
    }

    assert.strictEqual(charityAccountData.name.toString(), name.toString(), "Name doesn't match");
    assert.strictEqual(charityAccountData.description.toString(), description.toString(), "Description doesn't match");
    assert.strictEqual(charityAccountData.logo.toString(), logo.toString(), "Logo doesn't match");

    // Check event was emitted
    const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    const events = eventParser.parseLogs(tx.meta.logMessages);
    let logsEmitted = false;

    // Verify event info is correct
    for (let event of events) {
      if (event.name === "initializeCharityEvent") {
        logsEmitted = true;
        assert.strictEqual(event.data.name.toString(), name.toString(), "Event name doesn't match");
        assert.strictEqual(event.data.description.toString(), description.toString(), "Event description doesn't match");
        assert.strictEqual(event.data.logo.toString(), logo.toString(), "Event logo doesn't match");
      }
    }
    assert.isTrue(logsEmitted, "InitializeCharityEvent should have been emitted");
  });

  it("Initialize referral account with incorrect signer (should fail)", async () => {
    // Define data
    const name = "PCRF";
    const [charityPda] = await getCharityPda(name);
    const [charityVault] = await getCharityVaultPda(name);
    const description = "Palestine Children's Relief Fund";
    const logo = "placeholderfornow";

    // Perform transaction
    let flag = "This should fail";
    try {
      await program.methods
      .initCharity(name, description, logo)
      .accounts({
        authorizedCaller: bob.publicKey,
        charity: charityPda,
        charityVault,
        systemProgram: SystemProgram.programId
      })
      .signers([bob])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("address constraint was violated"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Incorrect caller signing should fail");
  });

  it("Initialize Bob's account", async () => {
    // Define data
    const [bobPda] = await getUserPda(bob.publicKey);
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
    const [leePda] = await getUserPda(lee.publicKey);
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
    const [leePda] = await getUserPda(lee.publicKey);
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

  it("Initialize Jack's account from incorrect signer (should fail)", async () => {
    // Define data
    const [jackPda] = await getUserPda(jack.publicKey);
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
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(bob.publicKey);

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
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(bob.publicKey);

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
