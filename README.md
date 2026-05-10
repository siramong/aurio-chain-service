<div align="center">

<img src="logo.svg" alt="Aurio" width="80" height="80" />

# Aurio Chain Service

**Hybrid on-chain/off-chain backend for the Aurio reward ecosystem**

A custom Solana program in Rust for trustless AURIO token minting, paired with an Express off-chain service for NFT issuance and data persistence.

[![Solana](https://img.shields.io/badge/Solana-devnet-14F195?logo=solana&logoColor=white)](https://explorer.solana.com/address/1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF?cluster=devnet)
[![Program](https://img.shields.io/badge/Program-1PFy2CW...iSF-blue)](https://explorer.solana.com/address/1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF?cluster=devnet)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-SBF-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  CLIENT (Frontend)                    │
└──────────────┬───────────────────────┬───────────────┘
               │                       │
        POST /create-tambu      POST /mint-aurio
               │                       │
┌──────────────▼───────────────────────▼───────────────┐
│              EXPRESS (Docker :3001)                    │
│                                                       │
│  /create-tambu                                       │
│  ├── Upsert profile in Supabase                      │
│  ├── Mint Tambu NFT via Metaplex SDK                 │
│  └── Insert business record in Supabase              │
│                                                       │
│  /mint-aurio                                         │
│  ├── Validate amount (1–1000)                        │
│  ├── Create/get recipient ATA                        │
│  └── Send transaction → on-chain program ──┐         │
│                                              │         │
└──────────────────────────────────────────────┼─────────┘
                                               │
                    ┌──────────────────────────▼──────────────────────────┐
                    │          AURIO REWARDS (Solana devnet)              │
                    │     Program: 1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3... │
                    │                                                     │
                    │  mint_reward instruction                            │
                    │  ├── Validate amount 1–1000                        │
                    │  ├── Convert to base units (×10⁶)                  │
                    │  ├── Verify PDA ["aurio_mint"]                      │
                    │  └── CPI → SPL Token mint_to (PDA-signed)          │
                    └─────────────────────────────────────────────────────┘
                                               │
┌──────────────────────────────────────────────▼─────────┐
│              EXTERNAL SERVICES                          │
│                                                         │
│  Supabase          Solana devnet          Metaplex      │
│  ├── profiles      ├── AURIO mint        ├── Token      │
│  └── businesses    └── Program account       Metadata   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## On-Chain Program

The `aurio-rewards` program is a custom Solana program written in **vanilla Rust** (no Anchor framework) deployed to **devnet**.

| Detail | Value |
|---|---|
| **Program ID** | `1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF` |
| **Language** | Rust (SBF) |
| **Framework** | Vanilla (`solana-program` crate) |
| **AURIO Mint** | `7BWgEFKQXcSfw9gB65qhvdJh4M9C9QwtsMrqLy95oQVS` |
| **Mint Authority PDA** | `4m7ApGAAtZ9b54j3xee9LCtsfhrEnsPk9nMwXywxsNui` |
| **PDA Seed** | `aurio_mint` |
| **Network** | Devnet |

### Instruction: `mint_reward`

Mints AURIO SPL tokens to a recipient's associated token account. The program is the **sole mint authority** — no off-chain keypair can mint tokens directly.

**Instruction data (9 bytes):**

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | Discriminator (`0x00`) |
| 1–8 | 8 | Amount (u64 LE, human-readable, 1–1000) |

**Accounts (in order):**

| Index | Name | Writable | Signer | Description |
|-------|------|----------|--------|-------------|
| 0 | `reward_authority` | No | No (PDA) | PDA `["aurio_mint"]`, signs via CPI |
| 1 | `mint` | Yes | No | AURIO SPL token mint |
| 2 | `recipient_ata` | Yes | No | Recipient's associated token account |
| 3 | `token_program` | No | No | SPL Token program |

**On-chain constraints:**
- Amount must be between 1 and 1000 (inclusive)
- Amount is converted to base units (multiplied by 10⁶) on-chain
- The `reward_authority` account must match the PDA derived from `["aurio_mint"]`
- The PDA must be the current mint authority of the AURIO mint

> See [`programs/aurio-rewards/README.md`](programs/aurio-rewards/README.md) for full program documentation.

## Off-Chain Service

### `POST /create-tambu`

Creates a Tambu business: mints a Metaplex NFT as the business's NFC marker, then persists the business record in Supabase.

```json
{
  "owner_id": "profile-uuid",
  "name": "Tambu Cafe",
  "wallet_adress": "SolanaBusinessWallet",
  "description": "Local cafe with Aurio rewards",
  "role": "user"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Business name |
| `owner_id` | No | Must be a valid UUID if provided |
| `wallet_adress` | No | Business Solana wallet |
| `description` | No | Business description |
| `role` | No | Defaults to `"user"` |

When `owner_id` is provided, the service upserts a matching `profiles` row in Supabase before creating the business. The NFT mint address is stored as `businesses.nfc_adress`.

### `POST /mint-aurio`

Mints AURIO reward tokens to a user wallet via the on-chain `aurio-rewards` program.

```json
{
  "userWallet": "UserSolanaWallet",
  "reviewText": "Great place",
  "businessId": "business-id",
  "amount": 10
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `userWallet` | Yes | Recipient Solana wallet address |
| `reviewText` | Yes | Review content |
| `amount` | Yes | Integer from 1 to 1000 |
| `businessId` | No | Business that triggered the reward |

The service validates the amount, ensures the recipient has an ATA, constructs a transaction invoking the on-chain program's `mint_reward` instruction, signs it with the server keypair (fee payer only), and sends it to devnet.

## Project Structure

```
aurio-chain-service/
├── src/                          # Express off-chain service
│   ├── index.ts                  # App entrypoint (Express server)
│   ├── routes/
│   │   ├── createTambu.ts        # POST /create-tambu handler
│   │   └── mintAurio.ts          # POST /mint-aurio handler (invokes on-chain program)
│   └── lib/
│       ├── solana.ts             # Solana RPC connection
│       ├── wallet.ts             # Keypair loader from env
│       ├── nft.ts                # Metaplex NFT minting
│       └── supabase.ts           # Supabase REST client (profiles, businesses)
├── programs/
│   └── aurio-rewards/            # Solana on-chain program (Rust)
│       ├── Cargo.toml
│       ├── idl.json              # Program IDL (uploaded on-chain)
│       ├── security.json         # Program metadata (uploaded on-chain)
│       └── src/
│           └── lib.rs            # Program entrypoint + mint_reward instruction
├── scripts/
│   └── transfer-authority.js     # One-time: transfers mint authority to PDA
├── public/
│   └── aurio.svg                 # Program logo (served via GitHub raw)
├── logo.svg                      # Repo root logo
├── Dockerfile                    # Multi-stage Node.js build
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 22+
- [Solana CLI](https://docs.solanalabs.com/cli/install) (for program deployment)
- `cargo-build-sbf` (bundled with Solana CLI)
- A Supabase project with `profiles` and `businesses` tables
- A Solana keypair with devnet SOL

### Environment

Create a `.env` file:

```env
PORT=3001

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

SOLANA_RPC=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=[1,2,3,...]

# Optional — defaults to the deployed devnet program
AURIO_PROGRAM_ID=1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF
```

`SOLANA_PRIVATE_KEY` must be a JSON array secret key. The env also accepts `MINT_AUTHORITY` as a fallback.

> Use `SUPABASE_SERVICE_ROLE_KEY` instead of the anon key — backend inserts can be blocked by RLS otherwise.

### Install & Run

```bash
npm install
npm run build
npm start
```

### Docker

```bash
docker compose up --build
```

The service starts on `http://localhost:3001`.

### Program Deployment (already deployed)

If you need to rebuild and redeploy the on-chain program:

```bash
# Build the Solana program
cargo-build-sbf --manifest-path programs/aurio-rewards/Cargo.toml

# Deploy to devnet
solana program deploy --url devnet \
  programs/aurio-rewards/target/deploy/aurio_rewards.so \
  --program-id programs/aurio-rewards/target/deploy/aurio_rewards-keypair.json

# Transfer mint authority to the program's PDA (one-time)
node scripts/transfer-authority.js

# Upload program metadata + IDL to Solana Explorer
npx @solana-program/program-metadata@latest write security <PROGRAM_ID> ./programs/aurio-rewards/security.json --rpc https://api.devnet.solana.com
npx @solana-program/program-metadata@latest write idl <PROGRAM_ID> ./programs/aurio-rewards/idl.json --rpc https://api.devnet.solana.com
```

## Supabase Schema

The service expects these tables:

```sql
-- profiles
CREATE TABLE profiles (
  id          UUID PRIMARY KEY,
  wallet_pubkey TEXT,
  role        TEXT DEFAULT 'user',
  display_name TEXT,
  created_at  TIMESTAMPTZ
);

-- businesses
CREATE TABLE businesses (
  id           UUID PRIMARY KEY,
  owner_id     UUID REFERENCES profiles(id),
  name         TEXT NOT NULL,
  wallet_adress TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ,
  nfc_adress   TEXT
);
```

## On-Chain Accounts (devnet)

| Account | Address | Description |
|---------|---------|-------------|
| Program | `1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF` | aurio-rewards program |
| AURIO Mint | `7BWgEFKQXcSfw9gB65qhvdJh4M9C9QwtsMrqLy95oQVS` | SPL token mint (6 decimals) |
| Mint Authority PDA | `4m7ApGAAtZ9b54j3xee9LCtsfhrEnsPk9nMwXywxsNui` | Program-owned, seed `aurio_mint` |
| Program Metadata | `HaX4SBcJQwRokJAFZPsZBxYirLfMCqSvwB38usm6zSck` | security.txt (via program-metadata) |
| Program IDL | `9iT8yNpuEnbQ34aJmZyqgdGSqNkhWHUMBvAtcLTGXRbj` | IDL (via program-metadata) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| On-chain program | Rust, `solana-program` v2, SBF |
| Token operations | SPL Token (CPI), Metaplex Token Metadata |
| Off-chain service | Node.js, Express 5, TypeScript |
| Database | Supabase (PostgreSQL + REST API) |
| Solana client | `@solana/web3.js`, `@solana/spl-token` |
| NFT minting | `@metaplex-foundation/umi`, `mpl-token-metadata` |
| Containerization | Docker, docker-compose |

## License

MIT
