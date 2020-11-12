use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;
use std::collections::BTreeMap;

#[derive(Default, BorshSerialize, BorshDeserialize)]
pub struct GsnInfo {
    pub is_initialized: bool,
    pub consumer: BTreeMap<String, u64>,
    pub executor: BTreeMap<String, u64>,
}

impl GsnInfo {
    pub fn serialize(&self, mut data: &mut [u8]) -> Result<(), ProgramError> {
        BorshSerialize::serialize(self, &mut data).map_err(|_| ProgramError::AccountDataTooSmall)
    }

    pub fn deserialize(mut data: &[u8]) -> Result<Self, ProgramError> {
        BorshDeserialize::deserialize(&mut data).map_err(|_| ProgramError::InvalidAccountData)
    }

    pub fn add_consumer(&mut self, address: String, amount: u64) -> bool {
        self.consumer.insert(address, amount);
        true
    }

    pub fn add_executor(&mut self, address: String, amount: u64) -> bool {
        self.executor.insert(address, amount);
        true
    }

    pub fn new() -> Self {
        Self {
            is_initialized: true,
            consumer: BTreeMap::new(),
            executor: BTreeMap::new(),
        }
    }
}
