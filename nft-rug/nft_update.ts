import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, createSignerFromKeypair, signerIdentity, generateSigner, percentAmount } from "@metaplex-foundation/umi"
import { updateV1, fetchMetadataFromSeeds, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { setAndVerifyCollection, updateMetadataAccountV2 } from '@metaplex-foundation/mpl-token-metadata';
import wallet from '../day1/Turbin3-wallet.json';
import { Keypair } from '@solana/web3.js';

async function main() {
    // Setup UMI
    const RPC_ENDPOINT = "https://api.devnet.solana.com";
    const umi = createUmi(RPC_ENDPOINT);

    let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
    const myKeypairSigner = createSignerFromKeypair(umi, keypair);
    umi.use(signerIdentity(myKeypairSigner));
    umi.use(mplTokenMetadata())

    const signer = createSignerFromKeypair(umi, keypair);


    const data = {
        name: 'Jeff Rug',
        symbol: 'JEFF',
        uri: 'https://gateway.irys.xyz/CBK5W4GDsRvQzjfDC2aFZvU3aQojLApd3HFUjv4Xhrbp',
        sellerFeeBasisPoints: 500,
        creators: [{"address":publicKey("3BLGfBreHxo1hUY2fdAiYGBqms3eMqiMCLdJGvXxhQ6V"),"share":100, "verified": true}],
    }

    // NFT mint address
    const mint = publicKey('4nUB3XMmsxUj8tdofwn8ckajsu63vp5Qowgb15FLVuDF');

    const initialMetadata = await fetchMetadataFromSeeds(umi, { mint })

    // ✅ Send the update instruction
    const tx = await updateV1(umi, {
        mint,
        authority: signer,
        data: { ...data },
    }).sendAndConfirm(umi)

    console.log("✅ URI updated! Signature:", tx.signature);
}

main();
