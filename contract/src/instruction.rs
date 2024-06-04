use borsh::BorshDeserialize;
use solana_program::{msg, program_error::ProgramError, pubkey::Pubkey};

pub enum StakeInstruction {
    Stake { duration: u64, stake_amount: u64 },
    Withdraw {},
    Close {},
}

#[derive(BorshDeserialize)]
struct StakePayload {
    duration: u64,
    stake_amount: u64,
}

impl StakeInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        msg!(
            "StakeInstruction: input {:?}, variant: {:?}, rest: {:?}",
            input,
            variant,
            rest
        );

        Ok(match variant {
            0 => {
                let payload = StakePayload::try_from_slice(rest).unwrap();
                Self::Stake {
                    duration: payload.duration,
                    stake_amount: payload.stake_amount,
                }
            }
            1 => Self::Withdraw {},
            2 => Self::Close {},
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
