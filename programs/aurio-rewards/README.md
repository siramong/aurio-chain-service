<div align="center">

<img src="../../logo.svg" alt="Aurio" width="56" height="56" />

# aurio-rewards

**Solana on-chain program for trustless AURIO token minting**

[![Solana devnet](https://img.shields.io/badge/devnet-1PFy2CW...iSF-14F195?logo=solana&logoColor=white)](https://explorer.solana.com/address/1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF?cluster=devnet)
[![Rust](https://img.shields.io/badge/Rust-SBF-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)

</div>

---

## Overview

`aurio-rewards` is a **custom Solana program written in vanilla Rust** (no Anchor framework) that serves as the **sole mint authority** for the AURIO SPL token. It enforces on-chain constraints that cannot be bypassed off-chain, ensuring reward amounts stay within defined limits regardless of how the program is invoked.

The program uses a **Program Derived Address (PDA)** as the mint authority signer. The original keypair's mint authority has been transferred to this PDA, meaning the program is the **only entity** that can mint AURIO tokens.

## Program Details

| Field | Value |
|---|---|
| **Program ID** | `1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF` |
| **Network** | Solana Devnet |
| **Language** | Rust |
| **Framework** | Vanilla (`solana-program` crate, no Anchor) |
| **Binary size** | ~28 KB |
| **AURIO Mint** | `7BWgEFKQXcSfw9gB65qhvdJh4M9C9QwtsMrqLy95oQVS` |
| **Mint Authority PDA** | `4m7ApGAAtZ9b54j3xee9LCtsfhrEnsPk9nMwXywxsNui` |
| **PDA Seed** | `aurio_mint` (UTF-8) |

## Instruction

### `mint_reward`

Mints AURIO SPL tokens to a recipient's associated token account via a cross-program invocation (CPI) into the SPL Token program, signed by the program's PDA.

#### Instruction Data

9 bytes total, little-endian:

```
[0x00] [amount_u64_le (8 bytes)]
  │         │
  │         └── Human-readable amount (1–1000)
  └── Discriminator for mint_reward
```

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0 | 1 byte | `u8` | Instruction discriminator (`0x00`) |
| 1 | 8 bytes | `u64` LE | Reward amount (human-readable, 1–1000) |

#### Accounts

The following accounts must be passed in order:

```
0. reward_authority  ── PDA ["aurio_mint"], read-only, CPI signer
1. mint              ── AURIO SPL token mint, writable
2. recipient_ata     ── Recipient's associated token account, writable
3. token_program     ── SPL Token program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)
```

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `reward_authority` | No | No* | PDA derived from `["aurio_mint"]`. Signs the inner CPI via `invoke_signed`. Must match the AURIO mint's current `mint_authority`. |
| 1 | `mint` | Yes | No | The AURIO SPL token mint account (`7BWgEFKQX...`). |
| 2 | `recipient_ata` | Yes | No | The recipient's associated token account for AURIO. Must be owned by the SPL Token program. |
| 3 | `token_program` | No | No | The SPL Token program. |

> \* The PDA is not a signer on the outer transaction — it signs the inner `mint_to` CPI instruction via `invoke_signed` with the seeds `["aurio_mint", bump]`.

#### On-Chain Validation

The program enforces these constraints before minting:

1. **Instruction data length** — Must be exactly 9 bytes.
2. **Discriminator** — First byte must be `0x00`.
3. **Amount range** — Amount must be ≥ 1 and ≤ 1000.
4. **Overflow protection** — Amount is multiplied by 10⁶ using `checked_mul`.
5. **PDA verification** — The `reward_authority` account must match the PDA derived from `["aurio_mint"]` and the program's own address.
6. **Mint authority check** — The PDA must be the current `mint_authority` of the AURIO mint (enforced by the SPL Token program during the CPI).

If any check fails, the transaction reverts with the appropriate `ProgramError`.

#### CPI Flow

```
aurio-rewards program
  │
  ├── Parse instruction data
  ├── Validate amount (1–1000)
  ├── Verify PDA account
  ├── Convert amount → base units (× 10⁶)
  │
  └── invoke_signed ──────────────────── SPL Token Program
        seeds: ["aurio_mint", bump]          │
                                            ├── Verify PDA is mint authority
                                            ├── Credit recipient_ata
                                            └── Update mint supply
```

## PDA Derivation

The mint authority PDA is derived deterministically:

```typescript
import { PublicKey } from "@solana/web3.js";

const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("aurio_mint")],
  new PublicKey("1PFy2CWq6n2YJJ9kHg7LDkBx5guSYvCH3UWmgKRZiSF")
);

// pda  → 4m7ApGAAtZ9b54j3xee9LCtsfhrEnsPk9nMwXywxsNui
// bump → 253
```

## Security

The program embeds a **security.txt** section in its ELF binary (via `solana-security-txt` crate) and has **on-chain program metadata** uploaded via the Solana Program Metadata program:

| Metadata | On-chain Account |
|----------|-----------------|
| security.txt (binary) | Embedded in program ELF |
| Program metadata | `HaX4SBcJQwRokJAFZPsZBxYirLfMCqSvwB38usm6zSck` |
| Program IDL | `9iT8yNpuEnbQ34aJmZyqgdGSqNkhWHUMBvAtcLTGXRbj` |

## Building

Requires `cargo-build-sbf` (bundled with the Solana CLI toolchain):

```bash
cargo-build-sbf --manifest-path programs/aurio-rewards/Cargo.toml
```

Output: `programs/aurio-rewards/target/deploy/aurio_rewards.so`

## Deploying

```bash
solana program deploy --url devnet \
  programs/aurio-rewards/target/deploy/aurio_rewards.so \
  --program-id programs/aurio-rewards/target/deploy/aurio_rewards-keypair.json
```

To upgrade an existing deployment, run the same command again — Solana's BPF Upgradeable Loader handles in-place upgrades.

## Source

The entire program lives in a single file:

```
src/lib.rs    ← entrypoint + process_instruction + build_mint_to_ix
```

### Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `solana-program` | 2 | Core Solana program SDK (entrypoint, account info, CPI, Pubkey) |
| `solana-security-txt` | 1 | Embeds security.txt in the program binary |

No other dependencies. No Anchor, no external accounts, no state.
