use crate::{error::PrizeError, instruction::StakeInstruction, state::StakeState};
use borsh::BorshSerialize;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh0_10::try_from_slice_unchecked,
    clock::Clock,
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
    let instruction = StakeInstruction::unpack(instruction_data)?;
    match instruction {
        StakeInstruction::Stake {
            duration,
            stake_amount,
        } => stake(program_id, accounts, duration, stake_amount),
        StakeInstruction::Withdraw {} => withdraw(program_id, accounts),
        StakeInstruction::Close {} => close(program_id, accounts),
    }
}

pub fn stake(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    duration: u64,
    stake_amount: u64,
) -> ProgramResult {
    msg!("Stake: {}, amount: {}", duration, stake_amount);
    let account_info_iter = &mut accounts.iter();

    let staker_account_info = next_account_info(account_info_iter)?;
    let pda_staker_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let staker_token_account_info = next_account_info(account_info_iter)?;
    let reward_pool_token_account_info = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let pda_program = next_account_info(account_info_iter)?;
    let prize_pool_ata = next_account_info(account_info_iter)?;

    if !staker_account_info.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature);
    }

    if *reward_pool_token_account_info.owner != spl_token::id() {
        return Err(ProgramError::IncorrectProgramId);
    }

    let (pda, bump_seed) = Pubkey::find_program_address(
        &[
            staker_account_info.key.as_ref(),
            "stake".as_bytes().as_ref(),
        ],
        program_id,
    );
    if pda != *pda_staker_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument);
    }

    let pda_staker_account_lamports = pda_staker_account.lamports();
    if pda_staker_account_lamports == 0u64 {
        let account_len: usize = 1000;
        let rent = Rent::get()?;
        let rent_lamports = rent.minimum_balance(account_len);

        invoke_signed(
            &system_instruction::create_account(
                staker_account_info.key,
                pda_staker_account.key,
                rent_lamports,
                account_len.try_into().unwrap(),
                program_id,
            ),
            &[
                staker_account_info.clone(),
                pda_staker_account.clone(),
                system_program.clone(),
            ],
            &[&[
                staker_account_info.key.as_ref(),
                "stake".as_bytes().as_ref(),
                &[bump_seed],
            ]],
        )?;
        msg!("PDA created: {}", pda);
    }

    ////////////////////////////////////////////////////////////////
    msg!("Transfer {} token from staker to reward pool", stake_amount);
    let transfer_token_to_reward_pool_ix = spl_token::instruction::transfer(
        token_program.key,
        staker_token_account_info.key,
        reward_pool_token_account_info.key,
        &staker_account_info.key,
        &[&staker_account_info.key],
        stake_amount,
    )?;

    invoke(
        &transfer_token_to_reward_pool_ix,
        &[
            staker_token_account_info.clone(),
            reward_pool_token_account_info.clone(),
            staker_account_info.clone(),
            token_program.clone(),
        ],
    )?;

    ////////////////////////////////////////////////////////////////

    let (_pda, bump_seed) = Pubkey::find_program_address(&[b"stake"], program_id);
    msg!(
        "Transfer {} token from reward pool to prize pool",
        stake_amount * 5
    );
    let transfer_token_to_prize_pool_ix = spl_token::instruction::transfer(
        token_program.key,
        reward_pool_token_account_info.key,
        prize_pool_ata.key,
        &_pda,
        &[&_pda],
        stake_amount * 5,
    )?;

    invoke_signed(
        &transfer_token_to_prize_pool_ix,
        &[
            staker_account_info.clone(),
            reward_pool_token_account_info.clone(),
            prize_pool_ata.clone(),
            pda_program.clone(),
            token_program.clone(),
        ],
        &[&[&b"stake"[..], &[bump_seed]]],
    )?;

    let mut stake_data =
        try_from_slice_unchecked::<StakeState>(&pda_staker_account.data.borrow()).unwrap();

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp as u64;

    stake_data.duration = duration;
    stake_data.stake_amount = stake_amount;
    stake_data.start_stake_time = current_timestamp;
    stake_data.end_stake_time = current_timestamp + duration * 24 * 60 * 60;
    if duration == 1 {
        stake_data.reward_stake_amount = (15 * stake_amount) / (365 * 100);
    } else {
        stake_data.reward_stake_amount = (7 * 20 * stake_amount) / (365 * 100);
    }
    stake_data.is_claimed = false;
    stake_data.is_initialized = true;

    stake_data.serialize(&mut &mut pda_staker_account.data.borrow_mut()[..])?;
    msg!("Finish stake");

    Ok(())
}

pub fn withdraw(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("Withdraw ...");

    let account_info_iter = &mut accounts.iter();

    let staker_account_info = next_account_info(account_info_iter)?;
    let pda_staker_account = next_account_info(account_info_iter)?;
    let staker_token_account_info = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let pda_program = next_account_info(account_info_iter)?;
    let reward_pool_token_account_info = next_account_info(account_info_iter)?;

    if !staker_account_info.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature);
    }

    let mut stake_data =
        try_from_slice_unchecked::<StakeState>(&pda_staker_account.data.borrow()).unwrap();

    if stake_data.is_claimed {
        msg!("Withdraw already claimed !!!");
        return Err(PrizeError::Claimed.into());
    }

    let (pda, _bump_seed) = Pubkey::find_program_address(
        &[
            staker_account_info.key.as_ref(),
            "stake".as_bytes().as_ref(),
        ],
        program_id,
    );
    if pda != *pda_staker_account.key {
        msg!("Invalid seeds for PDA");
        return Err(PrizeError::InvalidPDA.into());
    }

    // Getting clock directly
    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp as u64;
    msg!(
        "Current Timestamp: {} , start_stake_time: {}, end_stake_time: {}",
        current_timestamp,
        stake_data.start_stake_time,
        stake_data.end_stake_time
    );

    // if current_timestamp < stake_data.end_stake_time {
    //     return Err(ProgramError::BorshIoError(
    //         "Invalid time range!".to_string(),
    //     ));
    // }

    let (_pda, bump_seed) = Pubkey::find_program_address(&[b"stake"], program_id);
    msg!(
        "Transfer {} token from reward pool to staker",
        stake_data.reward_stake_amount
    );
    let transfer_token_to_staker_ix = spl_token::instruction::transfer(
        token_program.key,
        reward_pool_token_account_info.key,
        staker_token_account_info.key,
        &_pda,
        &[&_pda],
        stake_data.reward_stake_amount,
    )?;

    invoke_signed(
        &transfer_token_to_staker_ix,
        &[
            staker_account_info.clone(),
            reward_pool_token_account_info.clone(),
            staker_token_account_info.clone(),
            pda_program.clone(),
            token_program.clone(),
        ],
        &[&[&b"stake"[..], &[bump_seed]]],
    )?;

    stake_data.is_claimed = true;

    msg!("serializing account");
    stake_data.serialize(&mut &mut pda_staker_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}

pub fn close(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    msg!("Closing program ...");

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

    let pda_account_lamports = pda_account.lamports();
    if pda_account_lamports == 0u64 {
        return Err(ProgramError::InsufficientFunds);
    }
    **pda_account.try_borrow_mut_lamports()? -= pda_account_lamports;
    **initializer.try_borrow_mut_lamports()? += pda_account_lamports;

    return Ok(());
}
