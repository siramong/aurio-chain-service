use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
};

solana_security_txt::security_txt! {
    name: "Aurio Rewards",
    project_url: "https://aurio.xyz",
    contacts: "email:security@aurio.xyz",
    policy: "https://aurio.xyz/security",
    preferred_languages: "en",
    source_code: "https://github.com/siramong/aurio-chain-service",
    source_revision: "main"
}

entrypoint!(process_instruction);

const MAX_REWARD: u64 = 1000;
const DECIMALS: u32 = 6;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() != 9 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let discriminator = instruction_data[0];
    if discriminator != 0 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let amount = u64::from_le_bytes(
        instruction_data[1..9]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );

    if amount == 0 || amount > MAX_REWARD {
        msg!("Error: amount must be 1-{}", MAX_REWARD);
        return Err(ProgramError::InvalidArgument);
    }

    let base_units = amount
        .checked_mul(10u64.pow(DECIMALS))
        .ok_or(ProgramError::InvalidArgument)?;

    let accounts_iter = &mut accounts.iter();
    let reward_authority_info = next_account_info(accounts_iter)?;
    let mint_info = next_account_info(accounts_iter)?;
    let recipient_ata_info = next_account_info(accounts_iter)?;
    let token_program_info = next_account_info(accounts_iter)?;

    let (expected_pda, bump) =
        Pubkey::find_program_address(&[b"aurio_mint"], program_id);

    if reward_authority_info.key != &expected_pda {
        msg!("Error: invalid reward authority PDA");
        return Err(ProgramError::InvalidArgument);
    }

    let ix = build_mint_to_ix(
        token_program_info.key,
        mint_info.key,
        recipient_ata_info.key,
        reward_authority_info.key,
        base_units,
    );

    invoke_signed(
        &ix,
        &[
            mint_info.clone(),
            recipient_ata_info.clone(),
            reward_authority_info.clone(),
            token_program_info.clone(),
        ],
        &[&[b"aurio_mint", &[bump]]],
    )?;

    msg!("AURIO reward minted: {} tokens", amount);

    Ok(())
}

fn build_mint_to_ix(
    token_program: &Pubkey,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = Vec::with_capacity(9);
    data.push(7u8);
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: *token_program,
        accounts: vec![
            AccountMeta::new(*mint, false),
            AccountMeta::new(*destination, false),
            AccountMeta::new_readonly(*authority, true),
        ],
        data,
    }
}
