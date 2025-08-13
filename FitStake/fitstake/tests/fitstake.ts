import fs from "fs";
import path from "path";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fitstake } from "../target/types/fitstake";
import { assert } from "chai";
import { Keypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

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
    const date = new Date("2025-08-13T23:00:00Z");
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

  it("2. Initialize Lee's account", async () => {
    const [userPda] = getUserPda(lee.publicKey);
    await program.methods
      .initUser("Lee", "Brown", lee.publicKey, new anchor.BN(1234567890))
      .accountsPartial({
        program: programAuthority.publicKey,
        user: lee.publicKey,
        userAccount: userPda
      })
      .signers([programAuthority])
      .rpc();
  });

  it("3. Initialize Lee's account again (should fail)", async () => {
    const [userPda] = getUserPda(lee.publicKey);
    await assert.rejects(
      program.methods
        .initUser("Lee", "Brown", lee.publicKey, new anchor.BN(1234567890))
        .accounts({
          program: programAuthority.publicKey,
          user: lee.publicKey,
          userAccount: userPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([programAuthority])
        .rpc()
    );
  });

  it("4. Initialize Jack's account (program doesn't sign)", async () => {
    const [userPda] = getUserPda(jack.publicKey);
    await assert.rejects(
      program.methods
        .initUser("Jack", "Miller", jack.publicKey, new anchor.BN(1234567890))
        .accounts({
          program: jack.publicKey, // wrong signer
          user: jack.publicKey,
          userAccount: userPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([jack])
        .rpc()
    );
  });

  it("5. Bob creates a goal", async () => {
    const [goalPda] = getGoalPda(bob.publicKey, 1);
    const [vaultPda] = getVaultPda(goalPda);
    const [userPda] = getUserPda(bob.publicKey);
    await program.methods
      .initGoal(new anchor.BN(1), new anchor.BN(1_000_000), new anchor.BN(Date.now() / 1000 + 3600), PublicKey.default, "Bob's goal")
      .accounts({
        user: bob.publicKey,
        userAccount: userPda,
        goalAccount: goalPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();
  });

  it("6. Lee creates a goal for Bob (should fail)", async () => {
    const [goalPda] = getGoalPda(bob.publicKey, 2);
    const [vaultPda] = getVaultPda(goalPda);
    const [userPda] = getUserPda(bob.publicKey);
    await assert.rejects(
      program.methods
        .initGoal(new anchor.BN(2), new anchor.BN(500_000), new anchor.BN(Date.now() / 1000 + 3600), PublicKey.default, "Invalid")
        .accounts({
          user: lee.publicKey, // wrong authority
          userAccount: userPda,
          goalAccount: goalPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([lee])
        .rpc()
    );
  });
});
