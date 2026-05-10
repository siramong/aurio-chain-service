import { Router } from "express";

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

import { connection } from "../lib/solana.js";
import { loadWallet } from "../lib/wallet.js";

const AURIO_MINT = new PublicKey(
  "7BWgEFKQXcSfw9gB65qhvdJh4M9C9QwtsMrqLy95oQVS"
);

const PROGRAM_ID = new PublicKey(
  process.env.AURIO_PROGRAM_ID ??
    "1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF"
);

const MAX_REWARD_AMOUNT = 1000;

const [REWARD_AUTHORITY_PDA] =
  PublicKey.findProgramAddressSync(
    [Buffer.from("aurio_mint")],
    PROGRAM_ID
  );

export const mintAurioRouter = Router();

mintAurioRouter.post(
  "/",
  async (req, res) => {
    try {
      const {
        userWallet,
        reviewText,
        businessId,
        amount,
      } = req.body;

      if (
        !userWallet ||
        !reviewText ||
        amount === undefined
      ) {
        return res.status(400).json({
          success: false,
          error: "Missing fields",
        });
      }

      const payer = loadWallet();

      const owner = new PublicKey(userWallet);

      const rewardAmount = Number(amount);

      if (
        !Number.isFinite(rewardAmount) ||
        !Number.isInteger(rewardAmount) ||
        rewardAmount <= 0 ||
        rewardAmount > MAX_REWARD_AMOUNT
      ) {
        return res.status(400).json({
          success: false,
          error: `amount must be greater than 0 and less than or equal to ${MAX_REWARD_AMOUNT}`,
        });
      }

      const ata =
        await getOrCreateAssociatedTokenAccount(
          connection,
          payer,
          AURIO_MINT,
          owner
        );

      const data = Buffer.alloc(9);
      data.writeUInt8(0, 0);
      data.writeBigUInt64LE(
        BigInt(rewardAmount),
        1
      );

      const instruction =
        new TransactionInstruction({
          keys: [
            {
              pubkey: REWARD_AUTHORITY_PDA,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: AURIO_MINT,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: ata.address,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: TOKEN_PROGRAM_ID,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data,
        });

      const transaction =
        new Transaction().add(instruction);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;
      transaction.lastValidBlockHeight =
        lastValidBlockHeight;

      transaction.sign(payer);

      const signature =
        await connection.sendRawTransaction(
          transaction.serialize()
        );

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      return res.json({
        success: true,
        signature,
        mintedTo: userWallet,
        amount: rewardAmount,
        businessId,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      });
    }
  }
);
