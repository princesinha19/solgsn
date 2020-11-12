// @flow

import {
  Account,
  Connection,
  BpfLoader,
  BPF_LOADER_DEPRECATED_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import * as BufferLayout from 'buffer-layout';
import BN from 'bn.js';
import assert from 'assert';

import {url, urlTls} from '../../url';
import {Store} from './util/store';
import {newAccountWithLamports} from './util/new-account-with-lamports';
import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';
import {deserialize} from './util/borsh';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Connection to the network
 */
let payerAccount: Account;

/**
 * GSN program id
 */
let programId: PublicKey;

let programAccount: Account;
let gsnAccount: Account;
let senderAccount: Account;

/**
 * Program Path
 */
const pathToProgram = 'dist/program/solgsn.so';

/**
 * Topup Layout
 */
const topupLayout = BufferLayout.struct([
  BufferLayout.u8('instruction'),
  uint64('amount'),
]);

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  connection = new Connection(url, 'recent');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', url, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  if (!payerAccount) {
    let fees = 0;
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to load the program
    const data = await fs.readFile(pathToProgram);
    const NUM_RETRIES = 500; // allow some number of retries
    fees +=
      feeCalculator.lamportsPerSignature *
        (BpfLoader.getMinNumSignatures(data.length) + NUM_RETRIES) +
      (await connection.getMinimumBalanceForRentExemption(data.length));

    // Calculate the cost to fund the greeter account
    fees += await await connection.getMinimumBalanceForRentExemption(
      topupLayout.span,
    );

    // Calculate the cost of sending the transactions
    fees += feeCalculator.lamportsPerSignature * 1000000; // wag

    payerAccount = await newAccountWithLamports(connection, fees);
  }
}

/**
 * Load the GSN program if not already loaded
 */
export async function loadProgram(): Promise<void> {
  const store = new Store();

  // Check if the program has already been loaded
  try {
    let config = await store.load('config.json');
    programId = new PublicKey(config.programId);
    await connection.getAccountInfo(programId);
    console.log('Program already loaded to account', programId.toBase58());
    return;
  } catch (err) {
    // try to load the program
  }

  // Load the program
  console.log('\nLoading program...\n');
  const data = await fs.readFile(pathToProgram);
  programAccount = new Account();

  await BpfLoader.load(
    connection,
    payerAccount,
    programAccount,
    data,
    BPF_LOADER_DEPRECATED_PROGRAM_ID,
  );

  programId = programAccount.publicKey;
  console.log('Program loaded to account', programId.toBase58());

  // Save this info for next time
  await store.save('config.json', {
    url: urlTls,
    programId: programId.toBase58(),
  });
}

/**
 * Load the program
 */
export async function initialize(): Promise<void> {
  const newProgram = new Account();

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payerAccount.publicKey,
      newAccountPubkey: newProgram.publicKey,
      lamports: 1000000,
      space: 1024,
      programId,
    }),
  );

  await sendAndConfirmTransaction(
    'create',
    connection,
    tx,
    payerAccount,
    newProgram,
  );

  console.log('\nInitializing program...');

  const keys = [
    {pubkey: newProgram.publicKey, isSigner: false, isWritable: true},
  ];

  const initLayout = BufferLayout.struct([BufferLayout.u8('instruction')]);

  const chunkSize = 1280 - 40 - 8 - 300;
  const data = Buffer.alloc(chunkSize + 16);

  initLayout.encode(
    {
      instruction: 0,
    },
    data,
  );

  const instruction = new TransactionInstruction({
    keys,
    programId,
    data,
  });

  await sendAndConfirmTransaction(
    'initialize',
    connection,
    new Transaction().add(instruction),
    payerAccount,
  );

  gsnAccount = newProgram;

  console.log('Program succesfully initialized.\n');
}

/**
 * Topup Account
 */
export async function topup(): Promise<void> {
  senderAccount = await newAccountWithLamports(connection, 1000000000);

  const keys = [
    {pubkey: gsnAccount.publicKey, isSigner: false, isWritable: true},
    {pubkey: senderAccount.publicKey, isSigner: false, isWritable: true},
  ];

  const data = Buffer.alloc(topupLayout.span);

  topupLayout.encode(
    {
      instruction: 1,
      amount: new u64(10000000).toBuffer(),
    },
    data,
  );

  console.log('Topping up account...');
  const instruction = new TransactionInstruction({
    keys,
    programId,
    data,
  });

  await sendAndConfirmTransaction(
    'topup',
    connection,
    new Transaction().add(instruction),
    payerAccount,
  );
  console.log('Topup successful.');
}

/**
 * Submit Transaction
 */
export async function submitTx(): Promise<void> {
  const recieverAccount = await newAccountWithLamports(connection, 0);
  const feePayerAccount = await newAccountWithLamports(connection, 10000000);
  const transferPublicKey = new PublicKey('11111111111111111111111111111111');

  const keys = [
    {pubkey: transferPublicKey, isSigner: false, isWritable: true},
    {pubkey: senderAccount.publicKey, isSigner: true, isWritable: true},
    {pubkey: recieverAccount.publicKey, isSigner: false, isWritable: true},
    {pubkey: feePayerAccount.publicKey, isSigner: false, isWritable: true},
    {pubkey: gsnAccount.publicKey, isSigner: false, isWritable: true},
  ];

  const submitLayout = BufferLayout.struct([
    BufferLayout.u8('instruction'),
    uint64('amount'),
  ]);

  const data = Buffer.alloc(submitLayout.span);

  submitLayout.encode(
    {
      instruction: 2,
      amount: new u64(1000000000).toBuffer(),
    },
    data,
  );

  const senderAccountBal = await connection.getBalance(senderAccount.publicKey);
  console.log(
    '\nBalance Of Sender Account : ',
    senderAccountBal / LAMPORTS_PER_SOL,
    'Sol',
  );

  const recieverAccountBal = await connection.getBalance(
    recieverAccount.publicKey,
  );
  console.log(
    'Balance Of Receiver Account : ',
    recieverAccountBal / LAMPORTS_PER_SOL,
    'Sol',
  );

  const feePayerAccountBal = await connection.getBalance(
    feePayerAccount.publicKey,
  );
  console.log(
    'Balance Of Gas Payer : ',
    feePayerAccountBal / LAMPORTS_PER_SOL,
    'Sol',
  );

  console.log('\nTransfer 1 SOL from Sender To Receiver');
  console.log('Submitting Transaction... \n');
  const instruction = new TransactionInstruction({
    keys,
    programId,
    data,
  });

  const trans = new Transaction({
    feePayer: feePayerAccount.publicKey,
  }).add(instruction);

  await sendAndConfirmTransaction(
    'topup',
    connection,
    trans,
    senderAccount,
    feePayerAccount,
  );

  const senderAccountBalNew = await connection.getBalance(
    senderAccount.publicKey,
  );
  console.log(
    'Balance Of Sender Account : ',
    senderAccountBalNew / LAMPORTS_PER_SOL,
    'Sol',
  );

  const recieverAccountBalNew = await connection.getBalance(
    recieverAccount.publicKey,
  );
  console.log(
    'Balance Of Receiver Account : ',
    recieverAccountBalNew / LAMPORTS_PER_SOL,
    'Sol',
  );

  const feePayerAccountBalNew = await connection.getBalance(
    feePayerAccount.publicKey,
  );
  console.log(
    'Balance Of Gas Payer : ',
    feePayerAccountBalNew / LAMPORTS_PER_SOL,
    'Sol\n',
  );
}

/**
 * Blockchain State
 */
export async function printState(): Promise<void> {
  let data = await connection.getAccountInfo(gsnAccount.publicKey);

  const schema = {
    is_initialized: 'bool',
    // executor: {
    //     address: "string",
    //     amount: "u64"
    // }
  };

  const fieldType = ['bool', ''];

  const res = deserialize(schema, fieldType, data.data);
  // console.log("result: ", res);
}

/**
 * 64-bit value
 */
export class u64 extends BN {
  /**
   * Convert to Buffer representation
   */
  toBuffer(): typeof Buffer {
    const a = super.toArray().reverse();
    const b = Buffer.from(a);
    if (b.length === 8) {
      return b;
    }
    assert(b.length < 8, 'u64 too large');

    const zeroPad = Buffer.alloc(8);
    b.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a u64 from Buffer representation
   */
  static fromBuffer(buffer: typeof Buffer): u64 {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

function uint64(property: string = 'uint64') {
  return BufferLayout.blob(8, property);
}

/* Test */
export async function testTransfer(): Promise<void> {
  // Fund a new payer via airdrop
  payerAccount = await newAccountWithLamports(connection, 10000000000);

  // Fund a new payer via airdrop
  const payerAccount1 = await newAccountWithLamports(connection, 10000000000);

  // Fund a new payer via airdrop
  const payerAccount2 = await newAccountWithLamports(connection, 10000000000);

  const transaction = SystemProgram.transfer({
    fromPubkey: payerAccount.publicKey,
    toPubkey: payerAccount1.publicKey,
    lamports: 1000000000,
  });

  console.log(transaction.keys[0].isWritable.toString());

  const recentBlockhash = await connection.getRecentBlockhash();

  const tx = new Transaction({
    recentBlockhash: recentBlockhash.blockhash,
    feePayer: payerAccount2.publicKey,
  }).add(transaction);

  tx.partialSign(payerAccount);
  tx.partialSign(payerAccount2);

  const sign = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    commitment: 'recent',
    preflightCommitment: null,
  });

  await connection.confirmTransaction(sign);

  const lamports = await connection.getBalance(payerAccount.publicKey);
  console.log(
    'Balance Of Sender Account : ',
    lamports / LAMPORTS_PER_SOL,
    'Sol',
  );

  const lamports1 = await connection.getBalance(payerAccount1.publicKey);
  console.log(
    'Balance Of Receiver Account: ',
    lamports1 / LAMPORTS_PER_SOL,
    'Sol',
  );

  const lamports2 = await connection.getBalance(payerAccount2.publicKey);
  console.log(
    'Balance Of Fee Payer Account : ',
    lamports2 / LAMPORTS_PER_SOL,
    'Sol',
  );
}
