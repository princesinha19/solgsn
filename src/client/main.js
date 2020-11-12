/**
 * Gas Station
 *
 * @flow
 */

import {
  establishConnection,
  establishPayer,
  loadProgram,
  initialize,
  topup,
  submitTx,
  printState,
  testTransfer,
} from './index';

async function main() {
  console.log("Let's say hello to a Solana account...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Load the program if not already loaded
  await loadProgram();

  // Initialize the program
  await initialize();

  // Topup the account
  await topup();

  // Submit Transaction
  await submitTx();

  // Print State
  await printState();

  // await testTransfer();

  console.log('Success');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit());
