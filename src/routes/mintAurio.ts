import { Router } from "express";

import {
  PublicKey,
} from "@solana/web3.js";

import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";

import { connection } from "../lib/solana.js";
import { loadWallet } from "../lib/wallet.js";

const AURIO_MINT =
  new PublicKey(
    "7BWgEFKQXcSfw9gB65qhvdJh4M9C9QwtsMrqLy95oQVS"
  );

const TOKEN_DECIMALS = 6;
const MAX_REWARD_AMOUNT = 1000;

export const mintAurioRouter =
  Router();

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

      if (!userWallet || !reviewText || amount === undefined) {
        return res.status(400).json({
          success: false,
          error:
            "Missing fields",
        });
      }

      const payer =
        loadWallet();

      const owner =
        new PublicKey(userWallet);

      const rewardAmount = Number(amount);

      if (
        !Number.isFinite(rewardAmount) ||
        !Number.isInteger(rewardAmount) ||
        rewardAmount <= 0 ||
        rewardAmount > MAX_REWARD_AMOUNT
      ) {
        return res.status(400).json({
          success: false,
          error:
            `amount must be greater than 0 and less than or equal to ${MAX_REWARD_AMOUNT}`,
        });
      }

      // SPL tokens are minted in base units, so convert whole AURIO amounts using the mint decimals.
      const multiplier =
        BigInt(10) **
        BigInt(TOKEN_DECIMALS);
      const rawRewardAmount =
        BigInt(rewardAmount) *
        multiplier;

      const ata =
        await getOrCreateAssociatedTokenAccount(
          connection,
          payer,
          AURIO_MINT,
          owner
        );

      const signature =
        await mintTo(
          connection,
          payer,
          AURIO_MINT,
          ata.address,
          payer,
          rawRewardAmount
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
