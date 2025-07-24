import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import secret from "../day1/Turbin3-wallet.json";

// ✅ Load your wallet
const payer = Keypair.fromSecretKey(new Uint8Array(secret));

// ✅ Connect to Solana (devnet or mainnet-beta)
const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

// ✅ Replace with your NFT mint address
const mintAddress = "GVSvX6rcD8E1vYMygGCMn7YRQCTxeqBtpGABE9APFhtx";
const mint = new PublicKey(mintAddress);

// ✅ Replace with the owner address (usually your wallet)
const owner = payer.publicKey;

async function ensureATA() {
    try {
        // ⚠️ Get or create ATA for the owner wallet to hold this mint
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,      // connection
            payer,           // payer for transaction fees
            mint,            // mint address of the NFT
            owner            // owner of the ATA (your wallet)
        );

        console.log("✅ ATA exists or created successfully:");
        console.log("ATA Address:", ata.address.toBase58());
    } catch (err) {
        console.error("❌ Error creating ATA:", err);
    }
}

ensureATA();