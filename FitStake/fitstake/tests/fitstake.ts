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

  const program = anchor.workspace.FitStake as Program<Fitstake>;

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

  it("1. Initialize Bob's account", async () => {
    const [userPda] = getUserPda(bob.publicKey);
    await program.methods
      .initUser("Bob", "Smith", bob.publicKey, new anchor.BN(1234567890))
      .accounts({
        program: caller.publicKey,
        user: bob.publicKey,
        userAccount: userPda,
        systemProgram: SystemProgram.programId
      })
      .signers([caller])
      .rpc();
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
