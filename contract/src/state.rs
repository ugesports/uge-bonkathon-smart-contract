use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_pack::{IsInitialized, Sealed};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct ConfigState {
    pub is_initialized: bool,
    pub rating: u8,
    pub description: String,
    pub title: String,
}

impl Sealed for ConfigState {}

impl IsInitialized for ConfigState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
