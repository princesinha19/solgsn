/// Instructions supported by the SolGSN.
use solana_program::program_error::ProgramError;
use std::mem::size_of;

/// Topup argument structure
#[repr(C)]
#[derive(Clone, Debug, PartialEq)]
pub struct TopupAgrs {
    pub amount: u64,
}

/// Submit argument structure
#[repr(C)]
#[derive(Clone, Debug, PartialEq)]
pub struct SubmitArgs {
    pub amount: u64,
}

#[repr(C)]
#[derive(Clone, Debug, PartialEq)]
pub enum GsnInstruction {
    Initialize,
    Topup(TopupAgrs),
    SubmitTransaction(SubmitArgs),
}

impl GsnInstruction {
    pub fn deserialize(input: &[u8]) -> Result<Self, ProgramError> {
        if input.len() < size_of::<u8>() {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(match input[0] {
            0 => Self::Initialize,
            1 => {
                let val: &TopupAgrs = unpack(input)?;
                Self::Topup(val.clone())
            }
            2 => {
                let val: &SubmitArgs = unpack(input)?;
                Self::SubmitTransaction(val.clone())
            }
            _ => return Err(ProgramError::InvalidAccountData),
        })
    }
}

/// Unpacks a reference from a bytes buffer.
pub fn unpack<T>(input: &[u8]) -> Result<&T, ProgramError> {
    if input.len() < size_of::<u8>() + size_of::<T>() {
        return Err(ProgramError::InvalidAccountData);
    }
    #[allow(clippy::cast_ptr_alignment)]
    let val: &T = unsafe { &*(&input[1] as *const u8 as *const T) };
    Ok(val)
}
