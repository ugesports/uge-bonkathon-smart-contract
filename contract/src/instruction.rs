use borsh::BorshDeserialize;
use solana_program::{program_error::ProgramError, pubkey::Pubkey};

pub enum PrizeInstruction {
    InitConfig {
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
    },
    UpdateConfig {
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
    },

    Claim {},
    Close {},
}

#[derive(BorshDeserialize)]
struct ConfigPayload {
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
}

impl PrizeInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        let payload = ConfigPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::InitConfig {
                total_prize: payload.total_prize,
                first_prize: payload.first_prize,
                second_prize: payload.second_prize,
                third_prize: payload.third_prize,
                first_account: payload.first_account,
                second_account: payload.second_account,
                third_account: payload.third_account,
                is_first_claimed: payload.is_first_claimed,
                is_second_claimed: payload.is_second_claimed,
                is_third_claimed: payload.is_third_claimed,
                start_time: payload.start_time,
                end_time: payload.end_time,
            },
            1 => Self::UpdateConfig {
                total_prize: payload.total_prize,
                first_prize: payload.first_prize,
                second_prize: payload.second_prize,
                third_prize: payload.third_prize,
                first_account: payload.first_account,
                second_account: payload.second_account,
                third_account: payload.third_account,
                is_first_claimed: payload.is_first_claimed,
                is_second_claimed: payload.is_second_claimed,
                is_third_claimed: payload.is_third_claimed,
                start_time: payload.start_time,
                end_time: payload.end_time,
            },
            2 => Self::Claim {},
            3 => Self::Close {},
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
