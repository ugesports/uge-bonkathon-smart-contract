use crate::error::PrizeError;
use crate::instruction::PrizeInstruction;
use crate::state::ConfigState;
use borsh::BorshSerialize;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh0_10::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::IsInitialized,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};
use std::convert::TryInto;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = PrizeInstruction::unpack(instruction_data)?;
    match instruction {
        PrizeInstruction::InitConfig {
            total_prize,
            first_prize,
            second_prize,
            third_prize,
            first_account,
            second_account,
            third_account,
            is_first_claimed,
            is_second_claimed,
            is_third_claimed,
            start_time,
            end_time,
        } => init_config(
            program_id,
            accounts,
            total_prize,
            first_prize,
            second_prize,
            third_prize,
            first_account,
            second_account,
            third_account,
            is_first_claimed,
            is_second_claimed,
            is_third_claimed,
            start_time,
            end_time,
        ),
        PrizeInstruction::UpdateConfig {
            total_prize,
            first_prize,
            second_prize,
            third_prize,
            first_account,
            second_account,
            third_account,
            is_first_claimed,
            is_second_claimed,
            is_third_claimed,
            start_time,
            end_time,
        } => update_config(
            program_id,
            accounts,
            total_prize,
            first_prize,
            second_prize,
            third_prize,
            first_account,
            second_account,
            third_account,
            is_first_claimed,
            is_second_claimed,
            is_third_claimed,
            start_time,
            end_time,
        ),
        PrizeInstruction::Claim {} => claim(program_id, accounts),
    }
}

pub fn init_config(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    total_prize: u64,
    first_prize: u64,
    second_prize: u64,
    third_prize: u64,
    first_account: Pubkey,
    second_account: Pubkey,
    third_account: Pubkey,
    is_first_claimed: bool,
    is_second_claimed: bool,
    is_third_claimed: bool,
    start_time: u64,
    end_time: u64,
) -> ProgramResult {
    msg!("Init config");
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature);
    }

    let (pda, bump_seed) = Pubkey::find_program_address(
        &[initializer.key.as_ref(), "config-prize".as_bytes().as_ref()],
        program_id,
    );
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument);
    }

    if start_time > end_time {
        msg!("Start time cannot be higher than End time");
        return Err(PrizeError::InvalidTime.into());
    }

    let total_len: usize = 1 + 4 * 1 + 4 * 6 + 32 * 3;
    if total_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(PrizeError::InvalidDataLength.into());
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            pda_account.key,
            rent_lamports,
            account_len.try_into().unwrap(),
            program_id,
        ),
        &[
            initializer.clone(),
            pda_account.clone(),
            system_program.clone(),
        ],
        &[&[
            initializer.key.as_ref(),
            "config-prize".as_bytes().as_ref(),
            &[bump_seed],
        ]],
    )?;

    msg!("PDA created: {}", pda);

    msg!("unpacking state account");
    let mut account_data =
        try_from_slice_unchecked::<ConfigState>(&pda_account.data.borrow()).unwrap();
    msg!("borrowed account data");

    msg!("checking if config account is already initialized");
    if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.total_prize = total_prize;
    account_data.first_prize = first_prize;
    account_data.second_prize = second_prize;
    account_data.third_prize = third_prize;
    account_data.first_account = first_account;
    account_data.second_account = second_account;
    account_data.third_account = third_account;
    account_data.is_first_claimed = is_first_claimed;
    account_data.is_second_claimed = is_second_claimed;
    account_data.is_third_claimed = is_third_claimed;
    account_data.start_time = start_time;
    account_data.end_time = end_time;
    account_data.is_initialized = true;

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}

pub fn update_config(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    total_prize: u64,
    first_prize: u64,
    second_prize: u64,
    third_prize: u64,
    first_account: Pubkey,
    second_account: Pubkey,
    third_account: Pubkey,
    is_first_claimed: bool,
    is_second_claimed: bool,
    is_third_claimed: bool,
    start_time: u64,
    end_time: u64,
) -> ProgramResult {
    msg!("Updating config");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
        return Err(ProgramError::IllegalOwner);
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("unpacking state account");
    let mut account_data =
        try_from_slice_unchecked::<ConfigState>(&pda_account.data.borrow()).unwrap();

    let (pda, _bump_seed) = Pubkey::find_program_address(
        &[initializer.key.as_ref(), "config-prize".as_bytes().as_ref()],
        program_id,
    );
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(PrizeError::InvalidPDA.into());
    }

    msg!("checking if config account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(PrizeError::UninitializedAccount.into());
    }

    if start_time > end_time {
        msg!("Start time cannot be higher than End time");
        return Err(PrizeError::InvalidTime.into());
    }

    let total_len: usize = 1 + 4 * 1 + 4 * 6 + 32 * 3;
    if total_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(PrizeError::InvalidDataLength.into());
    }

    account_data.total_prize = total_prize;
    account_data.first_prize = first_prize;
    account_data.second_prize = second_prize;
    account_data.third_prize = third_prize;
    account_data.first_account = first_account;
    account_data.second_account = second_account;
    account_data.third_account = third_account;
    account_data.is_first_claimed = is_first_claimed;
    account_data.is_second_claimed = is_second_claimed;
    account_data.is_third_claimed = is_third_claimed;
    account_data.start_time = start_time;
    account_data.end_time = end_time;

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}

pub fn claim(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("Claimming ...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let claim_account = next_account_info(account_info_iter)?;

    if !claim_account.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature);
    }

    msg!("unpacking state account");
    let mut account_data =
        try_from_slice_unchecked::<ConfigState>(&pda_account.data.borrow()).unwrap();

    let (pda, bump_seed) = Pubkey::find_program_address(
        &[initializer.key.as_ref(), "config-prize".as_bytes().as_ref()],
        program_id,
    );
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(PrizeError::InvalidPDA.into());
    }

    msg!("checking if config account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(PrizeError::UninitializedAccount.into());
    }

    let prize = get_prize(&claim_account.key, &account_data);

    msg!("Prize: {} {}", prize.0, prize.1);
    if prize.0 == 0u8 {
        msg!("Account is not a winner");
        return Err(PrizeError::NotWinner.into());
    }

    msg!(
        "Transfer {} SOL (lamports) -> account: {}",
        prize.1,
        claim_account.key
    );

    let system_program = next_account_info(account_info_iter)?;
    msg!("PDA account: {:?}", pda.clone());
    let transfer_sol_to_winner = system_instruction::transfer(&pda, claim_account.key, prize.1);

    // let signer = [
    //     [initializer.key.as_ref(), "config-prize".as_bytes().as_ref()][..],
    //     &[bump_seed],
    // ];
    // invoke_signed(
    //     &transfer_sol_to_winner,
    //     &[system_program.clone(), claim_account.clone()],
    //     &[&signer],
    // )?;

    if prize.0 == 1 {
        account_data.is_first_claimed = true;
    }

    if prize.0 == 2 {
        account_data.is_second_claimed = true;
    }

    if prize.0 == 3 {
        account_data.is_third_claimed = true;
    }

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}

fn get_prize(account: &Pubkey, config: &ConfigState) -> (u8, u64) {
    if account == &config.first_account {
        return (1u8, config.first_prize.clone());
    }

    if account == &config.second_account {
        return (2u8, config.second_prize.clone());
    }

    if account == &config.third_account {
        return (3u8, config.third_prize.clone());
    }

    (0u8, 0u64)
}
