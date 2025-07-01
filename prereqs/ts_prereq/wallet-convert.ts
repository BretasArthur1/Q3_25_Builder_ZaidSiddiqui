import bs58 from 'bs58';
import promptSync from 'prompt-sync';

const prompt = promptSync();

// Convert Base58 (Phantom) to Wallet file format (Vec<u8>)
function base58ToWallet() {
  const base58Input = prompt('Enter your base58 private key: ');
  try {
    const walletBytes = bs58.decode(base58Input);
    console.log('Wallet file format (byte array):');
    console.log(JSON.stringify(Array.from(walletBytes)));
  } catch (err) {
    console.error('Invalid base58 input!');
  }
}

// Convert Wallet file format (Vec<u8>) to Base58
function walletToBase58() {
  const input = prompt('Enter your wallet bytes array (comma-separated): ');
  try {
    const byteArray = input
      .split(',')
      .map((x: string) => parseInt(x.trim()))
      .filter((x: number) => !isNaN(x));
    const base58 = bs58.encode(Uint8Array.from(byteArray));
    console.log('Base58 private key:');
    console.log(base58);
  } catch (err) {
    console.error('Invalid byte array input!');
  }
}

// Prompt user to choose
const choice = prompt('Choose (1) base58 -> wallet OR (2) wallet -> base58: ');
if (choice === '1') {
  base58ToWallet();
} else if (choice === '2') {
  walletToBase58();
} else {
  console.log('Invalid choice.');
}
