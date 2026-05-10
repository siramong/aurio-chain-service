import "dotenv/config";

import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

import {
  AuthorityType,
  setAuthority,
} from "@solana/spl-token";

const AURIO_MINT = new PublicKey(
  "7BWgEFKQXcSfw9gB65qhvdJh4M9C9QwtsMrqLy95oQVS"
);

const PROGRAM_ID = new PublicKey(
  "1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF"
);

const [pda] =
  PublicKey.findProgramAddressSync(
    [Buffer.from("aurio_mint")],
    PROGRAM_ID
  );

const connection = new Connection(
  process.env.SOLANA_RPC,
  "confirmed"
);

const raw =
  process.env.SOLANA_PRIVATE_KEY ??
  process.env.MINT_AUTHORITY;

if (!raw) {
  console.error(
    "Missing SOLANA_PRIVATE_KEY or MINT_AUTHORITY in .env"
  );
  process.exit(1);
}

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(raw))
);

console.log("Mint:", AURIO_MINT.toBase58());
console.log("Current authority:", payer.publicKey.toBase58());
console.log("Transferring to PDA:", pda.toBase58());

const sig = await setAuthority(
  connection,
  payer,
  AURIO_MINT,
  payer,
  AuthorityType.MintTokens,
  pda
);

console.log("Done! Signature:", sig);
console.log(
  "The program PDA is now the sole mint authority for AURIO."
);
