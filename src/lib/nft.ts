import {
  createUmi,
} from "@metaplex-foundation/umi-bundle-defaults";

import {
  generateSigner,
  keypairIdentity,
  percentAmount,
} from "@metaplex-foundation/umi";

import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";

import bs58 from "bs58";

import {
  loadWallet,
} from "./wallet.js";

const rpc =
  process.env.SOLANA_RPC!;

export async function mintTambuNFT({
  name,
  symbol,
  uri,
}: {
  name: string;
  symbol: string;
  uri: string;
}) {
  const wallet = loadWallet();

  const umi = createUmi(rpc);

  umi.use(mplTokenMetadata());

  umi.use(
    keypairIdentity({
      publicKey: wallet.publicKey.toBase58(),
      secretKey: wallet.secretKey,
    } as any)
  );

  const mint =
    generateSigner(umi);

  await createNft(umi, {
    mint,
    name,
    symbol,
    uri,
    sellerFeeBasisPoints:
      percentAmount(0),
  }).sendAndConfirm(umi);

  return {
    mint:
      mint.publicKey.toString(),
  };
}
