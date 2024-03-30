use borsh::BorshDeserialize;
use solana_program::program_error::ProgramError;

pub enum PrizeInstruction {
    InitConfig {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateConfig {
        title: String,
        rating: u8,
        description: String,
    },
}

#[derive(BorshDeserialize)]
struct ConfigPayload {
    title: String,
    rating: u8,
    description: String,
}

impl PrizeInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        let payload = ConfigPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::InitConfig {
                title: payload.title,
                rating: payload.rating,
                description: payload.description,
            },
            1 => Self::UpdateConfig {
                title: payload.title,
                rating: payload.rating,
                description: payload.description,
            },
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
