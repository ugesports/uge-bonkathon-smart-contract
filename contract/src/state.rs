use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    program_pack::{IsInitialized, Sealed},
    pubkey::Pubkey,
};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct StakeState {
    pub is_initialized: bool,
    pub duration: u64,
    pub stake_amount: u64,
    pub start_stake_time: u64,
    pub end_stake_time: u64,
    pub is_claimed: bool,
}

impl Sealed for StakeState {}

impl IsInitialized for StakeState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
