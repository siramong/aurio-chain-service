import { Router } from "express";

import {
  mintTambuNFT,
} from "../lib/nft.js";

import {
  createBusiness,
  ensureProfile,
} from "../lib/supabase.js";

export const createTambuRouter =
  Router();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

createTambuRouter.post(
  "/",
  async (req, res) => {
    try {
      const {
        owner_id,
        name,
        wallet_adress,
        description,
        role,
      } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: "name required",
        });
      }

      const ownerId =
        typeof owner_id === "string" &&
        owner_id.trim()
          ? owner_id.trim()
          : null;

      if (
        ownerId !== null &&
        !UUID_PATTERN.test(ownerId)
      ) {
        return res.status(400).json({
          success: false,
          error: "owner_id must be a valid uuid",
        });
      }

      if (ownerId !== null) {
        await ensureProfile({
          id: ownerId,
          wallet_pubkey:
            wallet_adress ?? null,
          role:
            typeof role === "string" && role.trim()
              ? role.trim()
              : "user",
          display_name: name,
          created_at:
            new Date().toISOString(),
        });
      }

      const nft =
        await mintTambuNFT({
          name,
          symbol: "TAMBU",
          uri: "https://example.com",
        });

      const business =
        await createBusiness({
          id: crypto.randomUUID(),
          owner_id: ownerId,
          name,
          wallet_adress:
            wallet_adress ?? null,
          description:
            description ?? null,
          created_at:
            new Date().toISOString(),
          nfc_adress: nft.mint,
        });

      return res.json({
        success: true,
        tambu: nft,
        business,
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
