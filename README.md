# Aurio Chain Service

Small Express/Bun service for Aurio on-chain actions.

It currently handles:

- Creating a Tambu business by minting its NFT/NFC marker.
- Saving the business record in Supabase.
- Minting AURIO SPL token rewards to a user wallet.

## Requirements

- Bun
- Solana devnet RPC
- Supabase project
- A Solana keypair that is allowed to mint the AURIO token and Tambu NFTs

## Environment

Create a `.env` file:

```env
PORT=3001

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

SOLANA_RPC=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=[1,2,3,...]
```

`SOLANA_PRIVATE_KEY` must be a JSON array secret key. The service also accepts `MINT_AUTHORITY` as a fallback.

For Supabase, prefer `SUPABASE_SERVICE_ROLE_KEY` because backend inserts can be blocked by RLS when using anon keys.

## Run Locally

```bash
bun install
bun run src/index.ts
```

The service starts on:

```txt
http://localhost:3001
```

## Run With Docker

```bash
docker compose up --build
```

## API

### Create Tambu

```http
POST /create-tambu
```

Creates a Tambu NFT, stores its mint address as `businesses.nfc_adress`, and inserts the business in Supabase.

Request body:

```json
{
  "owner_id": "profile-uuid",
  "name": "Tambu Cafe",
  "wallet_adress": "SolanaBusinessWallet",
  "description": "Local cafe with Aurio rewards",
  "role": "user"
}
```

Required:

- `name`

Optional:

- `owner_id`
- `wallet_adress`
- `description`
- `role`

Notes:

- `owner_id`, when provided, must be a valid UUID.
- `owner_id` is linked to `profiles.id` in Supabase.
- The service ensures a matching `profiles` row before inserting the business.
- `role` defaults to `"user"` if omitted.
- `nfc_adress` is created by `mintTambuNFT()` and should not be sent by the client.

Example response:

```json
{
  "success": true,
  "tambu": {
    "mint": "NftMintAddress"
  },
  "business": []
}
```

### Mint Aurio

```http
POST /mint-aurio
```

Mints AURIO rewards to a user's associated token account.

Request body:

```json
{
  "userWallet": "UserSolanaWallet",
  "reviewText": "Great place",
  "businessId": "business-id",
  "amount": 10
}
```

Required:

- `userWallet`
- `reviewText`
- `amount`

Optional:

- `businessId`

Notes:

- `amount` is the user-facing AURIO amount.
- AURIO has 6 decimals, so the service converts `10` into `10_000_000` base units before calling `mintTo()`.
- `amount` must be an integer from `1` to `1000`.

Example response:

```json
{
  "success": true,
  "signature": "TransactionSignature",
  "mintedTo": "UserSolanaWallet",
  "amount": 10,
  "businessId": "business-id"
}
```

## Supabase Tables

The service expects:

- `businesses`
- `profiles`

`businesses.owner_id` should reference `profiles.id`.

`profiles.role` must accept the role sent in the request, or `"user"` when omitted.
