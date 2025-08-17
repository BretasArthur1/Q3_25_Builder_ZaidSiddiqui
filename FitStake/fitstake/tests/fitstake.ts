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

  // Setup caller and signer
  const secretKeyPath = path.resolve(__dirname, "./caller-wallet.json");
  const secretKeyString = fs.readFileSync(secretKeyPath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));

  // Define fee
  const STAKE_FEE = 0.3;

  // Test wallets
  // const programAuthority = provider.wallet.payer as anchor.web3.Keypair;
  const caller = Keypair.fromSecretKey(secretKey);
  const bob = anchor.web3.Keypair.generate();
  const lee = anchor.web3.Keypair.generate();
  const jack = anchor.web3.Keypair.generate();

  // PDAs
  const getUserPda = async (wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("user"), wallet.toBuffer()],
      program.programId
    );

  const getGoalPda = async (wallet: PublicKey, seed: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("goal"), wallet.toBuffer(), new anchor.BN(seed).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

  const getVaultPda = async (goal: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), goal.toBuffer()],
      program.programId
    );

  const getReferralPda = async (code: String) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("referral"), Buffer.from(code)],
      program.programId
    );

  const getCharityPda = async (name: String) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("charity"), Buffer.from(name)],
      program.programId
    );

  const getCharityVaultPda = async (name: String) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("charity"), Buffer.from("vault"), Buffer.from(name)],
      program.programId
    );

  const getProgramVault = async () => 
    PublicKey.findProgramAddressSync(
      [Buffer.from("fitstake"), Buffer.from("program"), Buffer.from("vault")],
      program.programId
    );

  // Map pubkeys to human-readable names
  const trackedAccounts: Record<string, { name: string; pubkey: PublicKey }> = {
    caller: { name: "Caller", pubkey: caller.publicKey },
    bob: { name: "Bob", pubkey: bob.publicKey },
    lee: { name: "Lee", pubkey: lee.publicKey },
  };

  let balancesBefore: Record<string, number> = {};

  beforeEach(async () => {
    balancesBefore = {};
    for (const [key, { pubkey }] of Object.entries(trackedAccounts)) {
      const balance = await provider.connection.getBalance(pubkey);
      balancesBefore[key] = balance;
    }
  });

  afterEach(async () => {
    for (const [key, { name, pubkey }] of Object.entries(trackedAccounts)) {
      const beforeLamports = balancesBefore[key] ?? 0;
      const afterLamports = await provider.connection.getBalance(pubkey);

      if (beforeLamports !== afterLamports) {
        const beforeSol = beforeLamports / LAMPORTS_PER_SOL;
        const afterSol = afterLamports / LAMPORTS_PER_SOL;
        const diff = afterSol - beforeSol;

        console.log(
          `${name} balance changed: ` +
          `${beforeSol.toFixed(6)} SOL → ${afterSol.toFixed(6)} SOL ` +
          `(Δ ${diff.toFixed(6)} SOL)`
        );
      }
    }
  });

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
      .initReferral(code, name)
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

    // // Check event was emitted
    // const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    // const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    // const events = eventParser.parseLogs(tx.meta.logMessages);
    // let logsEmitted = false;

    // // Verify event info is correct
    // for (let event of events) {
    //   if (event.name === "initializeReferralEvent") {
    //     logsEmitted = true;
    //     assert.strictEqual(event.data.name.toString(), name.toString(), "Event name doesn't match");
    //     assert.strictEqual(event.data.referralCode.toString(), code.toString(), "Event referral code doesn't match");
    //   }
    // }
    // assert.isTrue(logsEmitted, "InitializeReferralEvent should have been emitted");
  });

  it("Initialize referral account again (should fail)", async () => {
    // Define data
    const code = "9KLE";
    const [referralPda] = await getReferralPda(code);
    const name = "Zaid";

    // Perform transaction
    let flag = "This should fail";
    try {
      await program.methods
      .initReferral(code, name)
      .accounts({
        authorizedCaller: caller.publicKey,
        referral: referralPda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("already in use"), "Should fail with account already initialized error");
    }
    assert.strictEqual(flag, "Failed", "Reinitializing charity account should fail");
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
      .initReferral(code, name)
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

    assert.strictEqual(charityAccountData.name.toString(), name.toString(), "Name doesn't match");
    assert.strictEqual(charityAccountData.description.toString(), description.toString(), "Description doesn't match");
    assert.strictEqual(charityAccountData.logo.toString(), logo.toString(), "Logo doesn't match");

    // // Check event was emitted
    // const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    // const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    // const events = eventParser.parseLogs(tx.meta.logMessages);
    // let logsEmitted = false;

    // // Verify event info is correct
    // for (let event of events) {
    //   if (event.name === "initializeCharityEvent") {
    //     logsEmitted = true;
    //     assert.strictEqual(event.data.name.toString(), name.toString(), "Event name doesn't match");
    //     assert.strictEqual(event.data.description.toString(), description.toString(), "Event description doesn't match");
    //     assert.strictEqual(event.data.logo.toString(), logo.toString(), "Event logo doesn't match");
    //   }
    // }
    // assert.isTrue(logsEmitted, "InitializeCharityEvent should have been emitted");
  });

  it("Initialize charity account again (should fail)", async () => {
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
        authorizedCaller: caller.publicKey,
        charity: charityPda,
        charityVault,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("already in use"), "Should fail with account already initialized error");
    }
    assert.strictEqual(flag, "Failed", "Reinitializing charity account should fail");
  });

  it("Initialize charity account with incorrect signer (should fail)", async () => {
    // Define data
    const name = "random";
    const [charityPda] = await getCharityPda(name);
    const [charityVault] = await getCharityVaultPda(name);
    const description = "doesnt matter";
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

  it("Initialize Bob's account without referral", async () => {
    // Define data
    const [bobPda] = await getUserPda(bob.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Bob";
    const last_name = "Smith";
    const wallet = bob.publicKey;

    // Perform transaction
    let txSig = await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp), null)
      .accounts({
        authorizedCaller: caller.publicKey,
        user: bob.publicKey,
        userAccount: bobPda,
        referral: null,
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

    // // Check event was emitted
    // const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    // const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    // const events = eventParser.parseLogs(tx.meta.logMessages);
    // let logsEmitted = false;

    // // Verify event info is correct
    // for (let event of events) {
    //   if (event.name === "initializeUserEvent") {
    //     logsEmitted = true;
    //     assert.strictEqual(event.data.wallet.toString(), wallet.toString(), "Event wallet should match Bob's wallet");
    //   }
    // }
    // assert.isTrue(logsEmitted, "InitializeUserEvent should have been emitted");
  });

  it("Initialize Lee's account with referral", async () => {
    // Define data
    const [leePda] = await getUserPda(lee.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Lee";
    const last_name = "Jack";
    const wallet = lee.publicKey;
    const code = "9KLE";
    const [referralPda] = await getReferralPda(code);

    // Perform transaction
    let txSig = await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp), code)
      .accounts({
        authorizedCaller: caller.publicKey,
        user: lee.publicKey,
        userAccount: leePda,
        referral: referralPda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    
    // Ensure data on chain is correct
    const userAccountData = await program.account.userAccount.fetch(leePda);
    const referralAccountData = await program.account.referralAccount.fetch(referralPda);

    assert.strictEqual(userAccountData.firstName.toString(), first_name, "First name doesn't match");
    assert.strictEqual(userAccountData.lastName.toString(), last_name, "Last name doesn't match");
    assert.strictEqual(userAccountData.wallet.toBase58(), wallet.toBase58(), "Wallet doesn't match");
    assert.strictEqual(userAccountData.dateOfBirth.toString(), new anchor.BN(timestamp).toString(), "Date of birth doesn't match");
    assert.strictEqual(referralAccountData.referralCount.toString(), new anchor.BN(1).toString(), "Referral count doesn't match");

    // // Check event was emitted
    // const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    // const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    // const events = eventParser.parseLogs(tx.meta.logMessages);
    // let logsEmitted = false;

    // // Verify event info is correct
    // for (let event of events) {
    //   if (event.name === "initializeUserEvent") {
    //     logsEmitted = true;
    //     assert.strictEqual(event.data.wallet.toString(), wallet.toString(), "Event wallet should match Lee's wallet");
    //   }
    // }
    // assert.isTrue(logsEmitted, "InitializeUserEvent should have been emitted");
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
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp), null)
      .accounts({
        authorizedCaller: caller.publicKey,
        user: lee.publicKey,
        userAccount: leePda,
        referral: null,
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

  it("Initialize Jack's account with incorrect referral (should fail)", async () => {
    // Define data
    const [jackPda] = await getUserPda(jack.publicKey);
    const date = new Date("2000-08-13T23:00:00Z");
    const timestamp: number = Math.floor(date.getTime() / 1000);
    const first_name = "Jack";
    const last_name = "Lee";
    const wallet = jack.publicKey;
    const referral_code = "invalid";
    const [referralPda] = await getReferralPda(referral_code);

    // Perform transaction
    let flag = "This should fail";
    try {
      await program.methods
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp), referral_code)
      .accounts({
        authorizedCaller: caller.publicKey,
        user: jack.publicKey,
        userAccount: jackPda,
        referral: referralPda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("program expected this account to be already initialized"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Invalid referral should fail");
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
      .initUser(first_name, last_name, wallet, new anchor.BN(timestamp), null)
      .accounts({
        authorizedCaller: jack.publicKey,
        user: jack.publicKey,
        userAccount: jackPda,
        referral: null,
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
    const date = new Date("2030-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    const charity = "PCRF";
    const [charityPda] = await getCharityPda(charity);
    // const space = 8 + 8 + 8 + 1 + 32 + 4 + 200 + 1 + 1;
    // const rentExemptLamports = await provider.connection.getMinimumBalanceForRentExemption(space);

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(bob.publicKey);

    // Perform tx
    let txSig = await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charityPda, details)
      .accounts({
        user: bob.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        charity: charityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    // Ensure data on chain is correct
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);

    assert.strictEqual(goalAccountData.seed.toString(), seed.toString(), "Seed doesn't match");
    assert.strictEqual(goalAccountData.stakeAmount.toString(), stake_amount.toString(), "Stake amount doesn't match");
    assert.strictEqual(goalAccountData.charity.toString(), charityPda.toString(), "Charity public key doesn't match");
    assert.strictEqual(goalAccountData.deadline.toString(), deadline.toString(), "Deadline doesn't match");
    assert.strictEqual(goalAccountData.details.toString(), details.toString(), "Details don't match");
    assert.isTrue('incomplete' in goalAccountData.status, "Status doesn't match");
    assert.strictEqual(goalAccountData.user.toString(), bob.publicKey.toString(), "User doesn't match");

    // Check vault balance matches stake_amount
    const vaultAccountInfo = await provider.connection.getAccountInfo(vaultPda);
    assert.ok(vaultAccountInfo !== null, "Vault account should exist");
    assert.strictEqual(vaultAccountInfo.lamports, stake_amount, "Vault balance should equal the staked amount");

    // // Check event was emitted
    // const tx = await provider.connection.getParsedTransaction(txSig, "confirmed");
    // const eventParser = new anchor.EventParser(program.programId, new anchor.BorshCoder(program.idl));
    // const events = eventParser.parseLogs(tx.meta.logMessages);
    // let initializeGoalEmitted = false;
    // let depositStakeEmitted = false;

    // // Verify event info is correct
    // for (let event of events) {
    //   if (event.name === "initializeGoalEvent") {
    //     initializeGoalEmitted = true;
    //     assert.strictEqual(event.data.user.toString(), bob.publicKey.toString(), "Event user should match Bob's wallet");
    //     assert.strictEqual(event.data.seed.toString(), seed.toString(), "Event seed should match goal's seed");
    //     assert.strictEqual(event.data.deadline.toString(), deadline.toString(), "Event deadline should match goal's deadline");
    //     assert.strictEqual(event.data.charity.toString(), charity.publicKey.toString(), "Event charity should match goal's charity");
    //   }
    //   if (event.name === "depositStakeEvent") {
    //     depositStakeEmitted = true;
    //     assert.strictEqual(event.data.user.toString(), bob.publicKey.toString(), "Event user should match Bob's wallet");
    //     assert.strictEqual(event.data.amount.toString(), stake_amount.toString(), "Event stake amount should match goal's stake amount");
    //   }
    // }
    // assert.isTrue(initializeGoalEmitted, "InitializeGoalEvent should have been emitted");
    // assert.isTrue(depositStakeEmitted, "DepositStakeEvent should have been emitted");
  });

  it("Bob creates a goal with invalid charity (should fail)", async () => {
    // Define data
    const seed = 2;
    const stake_amount = 500_000;
    const date = new Date("2025-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    const charity = "invalid";

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(bob.publicKey);
    const [charityPda] = await getCharityPda(charity);

    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charityPda, details)
      .accounts({
        user: bob.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        charity: charityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("program expected this account to be already initialized"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Incorrect charity for a goal should fail");
  });

  it("Lee creates a goal for Bob (should fail)", async () => {
    // Define data
    const seed = 1;
    const stake_amount = 500_000;
    const date = new Date("2025-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    const charity = "PCRF";

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(bob.publicKey);
    const [charityPda] = await getCharityPda(charity);

    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charityPda, details)
      .accounts({
        user: lee.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        charity: charityPda,
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

  it("Lee claims Bob's goal (should fail)", async () => {
    // Get accounts and data
    const seed = 1;
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    
    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .completeGoal()
      .accounts({
        user: lee.publicKey,
        goalAccount: goalPda,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .signers([lee])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("seeds constraint was violated"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Cannot claim another's goal");
  });

  it("Lee forfeits Bob's goal (should fail)", async () => {
    // Get accounts and data
    const seed = 1;
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);
    const charityAccountData = await program.account.charityAccount.fetch(goalAccountData.charity);
    const [charityVault] = await getCharityVaultPda(charityAccountData.name);
    const [programVault] = await getProgramVault();
    
    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .forfeitGoal()
      .accounts({
        authorizedCaller: lee.publicKey,
        goalAccount: goalPda,
        vault,
        charity: goalAccountData.charity,
        charityVault,
        programVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([lee])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("address constraint was violated"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Cannot forfeit another's goal");
  });

  it("Caller forfeits Bob's goal before deadline (should fail)", async () => {
    // Get accounts and data
    const seed = 1;
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);
    const charityAccountData = await program.account.charityAccount.fetch(goalAccountData.charity);
    const [charityVault] = await getCharityVaultPda(charityAccountData.name);
    const [programVault] = await getProgramVault();
    
    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .forfeitGoal()
      .accounts({
        authorizedCaller: caller.publicKey,
        goalAccount: goalPda,
        vault,
        charity: goalAccountData.charity,
        charityVault,
        programVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("GoalDeadlineNotPassed"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Cannot forfeit goal before deadline");
  });

  it("Bob claims his goal", async () => {
    // Define data
    const seed = 1;

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);

    // Perform tx
    let txSig = await program.methods
      .completeGoal()
      .accounts({
        user: bob.publicKey,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    // Ensure data on chain is correct
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);

    assert.isTrue('complete' in goalAccountData.status, "Status doesn't match");

    // Check vault balance matches stake_amount
    const vaultAccountInfo = await provider.connection.getAccountInfo(vaultPda);
    assert.ok(vaultAccountInfo == null, "Vault account shouldn't exist");
  });

  it("Bob claims his goal again (should fail)", async () => {
    // Define data
    const seed = 1;

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);

    // Perform tx
    let flag = "This should fail";
    try { await program.methods
      .completeGoal()
      .accounts({
        user: bob.publicKey,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("GoalAlreadyCompleted"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Cannot complete goal again");
  });

  it("Caller forfeits Bob's goal after it has been claimed (should fail)", async () => {
    // Get accounts and data
    const seed = 1;
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);
    const charityAccountData = await program.account.charityAccount.fetch(goalAccountData.charity);
    const [charityVault] = await getCharityVaultPda(charityAccountData.name);
    const [programVault] = await getProgramVault();
    
    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .forfeitGoal()
      .accounts({
        authorizedCaller: caller.publicKey,
        goalAccount: goalPda,
        vault,
        charity: goalAccountData.charity,
        charityVault,
        programVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("GoalAlreadyCompleted"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Cannot forfeit a completed goal");
  });

  it("Bob creates a goal with passed deadline (for testing purposes)", async () => {
    // Define data
    const seed = 2;
    const stake_amount = 10_000_000;
    const date = new Date("2024-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    const charity = "PCRF";
    const [charityPda] = await getCharityPda(charity);

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(bob.publicKey);

    // Perform tx
    let txSig = await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charityPda, details)
      .accounts({
        user: bob.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        charity: charityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    // Ensure data on chain is correct
    const goalAccountData = await program.account.goalAccount.fetch(goalPda);

    assert.strictEqual(goalAccountData.seed.toString(), seed.toString(), "Seed doesn't match");
    assert.strictEqual(goalAccountData.stakeAmount.toString(), stake_amount.toString(), "Stake amount doesn't match");
    assert.strictEqual(goalAccountData.charity.toString(), charityPda.toString(), "Charity public key doesn't match");
    assert.strictEqual(goalAccountData.deadline.toString(), deadline.toString(), "Deadline doesn't match");
    assert.strictEqual(goalAccountData.details.toString(), details.toString(), "Details don't match");
    assert.isTrue('incomplete' in goalAccountData.status, "Status doesn't match");
    assert.strictEqual(goalAccountData.user.toString(), bob.publicKey.toString(), "User doesn't match");

    // Check vault balance matches stake_amount
    const vaultAccountInfo = await provider.connection.getAccountInfo(vaultPda);
    assert.ok(vaultAccountInfo !== null, "Vault account should exist");
    assert.strictEqual(vaultAccountInfo.lamports, stake_amount, "Vault balance should equal the staked amount");
  });

  it("Bob claims his new goal after deadline has passed (should fail)", async () => {
    // Define data
    const seed = 2;

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);

    // Perform tx
    let flag = "This should fail";
    try { 
      await program.methods
      .completeGoal()
      .accounts({
        user: bob.publicKey,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("GoalDeadlinePassed"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Claiming after deadline should fail");
  });

  it("Caller forfeits Bob's new goal", async () => {
    // Get accounts and data
    const seed = 2;
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    const goalAccountDataBefore = await program.account.goalAccount.fetch(goalPda);
    const charityAccountData = await program.account.charityAccount.fetch(goalAccountDataBefore.charity);
    const [charityVault] = await getCharityVaultPda(charityAccountData.name);
    const [programVault] = await getProgramVault();
    
    let txSig = await program.methods
      .forfeitGoal()
      .accounts({
        authorizedCaller: caller.publicKey,
        goalAccount: goalPda,
        vault,
        charity: goalAccountDataBefore.charity,
        charityVault,
        programVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([caller])
      .rpc();

    // Ensure data on chain is correct
    const goalAccountDataAfter = await program.account.goalAccount.fetch(goalPda);

    assert.isTrue('forfeited' in goalAccountDataAfter.status, "Status doesn't match");

    // Check vault balances are correct
    const vaultAccountInfo = await provider.connection.getAccountInfo(vault);
    const programVaultInfo = await provider.connection.getAccountInfo(programVault);
    const charityVaultInfo = await provider.connection.getAccountInfo(charityVault);
    const stakeAmount = goalAccountDataAfter.stakeAmount.toNumber();

    assert.ok(vaultAccountInfo == null, "Vault account shouldn't exist");
    assert.strictEqual(programVaultInfo.lamports, stakeAmount * STAKE_FEE, "Program vault balance not corret");
    assert.strictEqual(charityVaultInfo.lamports, stakeAmount * (1 - STAKE_FEE), "Charity vault balance not correct")
  });

  it("Bob claims his goal after it has been forfeited (should fail)", async () => {
    // Define data
    const seed = 2;

    // Get PDAs
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);

    // Perform tx
    let flag = "This should fail";
    try { 
      await program.methods
      .completeGoal()
      .accounts({
        user: bob.publicKey,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("GoalForfeited"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Claiming after forfeited should fail");
  });

  it("Program forfeits Bob's goal again (should fail)", async () => {
    // Get accounts and data
    const seed = 2;
    const [goalPda] = await getGoalPda(bob.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    const goalAccountDataBefore = await program.account.goalAccount.fetch(goalPda);
    const charityAccountData = await program.account.charityAccount.fetch(goalAccountDataBefore.charity);
    const [charityVault] = await getCharityVaultPda(charityAccountData.name);
    const [programVault] = await getProgramVault();

    // Perform tx
    let flag = "This should fail";
    try { 
      await program.methods
      .forfeitGoal()
      .accounts({
        authorizedCaller: caller.publicKey,
        goalAccount: goalPda,
        vault,
        charity: goalAccountDataBefore.charity,
        charityVault,
        programVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("GoalForfeited"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Forfeiting twice should fail");
  });

  it("Lee claims a non-existent goal (should fail)", async () => {
    // Define data
    const seed = 2;

    // Get PDAs
    const [goalPda] = await getGoalPda(lee.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);

    // Perform tx
    let flag = "This should fail";
    try { 
      await program.methods
      .completeGoal()
      .accounts({
        user: lee.publicKey,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([lee])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("program expected this account to be already initialized"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Can't claim a non-existent goal");
  });

  it("Program forfeits Lee's non-existent goal again (should fail)", async () => {
    // Get accounts and data
    const seed = 2;
    const [goalPda] = await getGoalPda(lee.publicKey, seed);
    const [vault] = await getVaultPda(goalPda);
    const [charityAccount] = await getCharityPda("PCRF");
    const [charityVault] = await getCharityVaultPda("PCRF");
    const [programVault] = await getProgramVault();

    // Perform tx
    let flag = "This should fail";
    try { 
      await program.methods
      .forfeitGoal()
      .accounts({
        authorizedCaller: caller.publicKey,
        goalAccount: goalPda,
        vault,
        charity: charityAccount,
        charityVault,
        programVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([caller])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("program expected this account to be already initialized"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Can't forfeit a non-existent goal");
  });

  it("Lee creates a goal with insufficient funds", async () => {
    // Define data
    const seed = 1;
    const stake_amount = Number.MAX_SAFE_INTEGER;
    const date = new Date("2030-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    const charity = "PCRF";
    const [charityPda] = await getCharityPda(charity);

    // Get PDAs
    const [goalPda] = await getGoalPda(lee.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(lee.publicKey);

    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charityPda, details)
      .accounts({
        user: lee.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        charity: charityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([lee])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("InsufficientFunds"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Insufficient funds should fail");
  });

  it("Lee creates a goal staking 0 lamports", async () => {
    // Define data
    const seed = 1;
    const stake_amount = 0;
    const date = new Date("2030-08-15T23:00:00Z");
    const deadline = Math.floor(date.getTime() / 1000);
    const details: string = "2000 steps";
    const charity = "PCRF";
    const [charityPda] = await getCharityPda(charity);

    // Get PDAs
    const [goalPda] = await getGoalPda(lee.publicKey, seed);
    const [vaultPda] = await getVaultPda(goalPda);
    const [userPda] = await getUserPda(lee.publicKey);

    // Perform tx
    let flag = "This should fail";
    try {
      await program.methods
      .initGoal(new anchor.BN(seed), new anchor.BN(stake_amount), new anchor.BN(deadline), charityPda, details)
      .accounts({
        user: lee.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        charity: charityPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([lee])
      .rpc();
    } catch (error) {
      flag = "Failed";
      assert(error.toString().includes("StakingZeroLamports"), error.toString());
    }
    assert.strictEqual(flag, "Failed", "Can't stake 0 lamports");
  });
});
