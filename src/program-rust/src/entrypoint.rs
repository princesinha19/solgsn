use crate::{error::GsnError, processor::Processor};
use solana_program::{
    account_info::AccountInfo, entrypoint_deprecated, program_error::PrintProgramError,
    pubkey::Pubkey,
};

entrypoint_deprecated!(process_instruction);

fn process_instruction<'a>(
    _program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> entrypoint_deprecated::ProgramResult {
    if let Err(error) = Processor::process(accounts, instruction_data) {
        // catch the error so we can print it
        error.print::<GsnError>();
        return Err(error);
    }
    Ok(())
}
