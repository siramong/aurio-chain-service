import { Keypair } from "@solana/web3.js";

export function loadWallet() {
  const raw =
    process.env.SOLANA_PRIVATE_KEY ??
    process.env.MINT_AUTHORITY;

  if (!raw) {
    throw new Error(
      "Missing SOLANA_PRIVATE_KEY or MINT_AUTHORITY"
    );
  }

  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(raw))
  );
}
