use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_pack::{IsInitialized, Sealed},
    pubkey::Pubkey,
};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct ConfigState {
    pub is_initialized: bool,
    pub total_prize: u64,
    pub first_prize: u64,
    pub second_prize: u64,
    pub third_prize: u64,
    pub first_account: Pubkey,
    pub second_account: Pubkey,
    pub third_account: Pubkey,
    pub is_first_claimed: bool,
    pub is_second_claimed: bool,
    pub is_third_claimed: bool,
    pub start_time: u64,
    pub end_time: u64,
}

impl Sealed for ConfigState {}

impl IsInitialized for ConfigState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
