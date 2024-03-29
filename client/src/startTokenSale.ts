import * as dotenv from "dotenv";
dotenv.config();

import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import BN = require("bn.js");
import * as borsh from "@project-serum/borsh";
import { createAccountInfo, updateEnv, getConfig, getIdoConfig } from "./utils";

import { TokenSaleAccountLayout } from "./account";
import {
  AccountLayout,
  createInitializeAccountInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import base58 = require("bs58");

const transaction = async () => {
  const configInstructionLayout = borsh.struct([
    borsh.u8("variant"),
    borsh.u64("total_prize"),
    borsh.u64("start_time"),
    borsh.u64("end_time"),
  ]);

  const DECIMAL = 9;

  //phase1 (setup Transaction & send Transaction)
  console.log("Setup Transaction");
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Onwer keypair
  const ownerKeypair = Keypair.fromSecretKey(
    base58.decode(process.env.OWNER_PRIVATE_KEY!)
  );

  const totalPrize = 100 * 10 ** 6; // 100 million

  // Program Address -> smartcontract
  const prizeProgramId = new PublicKey(process.env.CUSTOM_PROGRAM_ID!);

  const prizeAccountKeypair = new Keypair();
  const createPrizeAccountIx = SystemProgram.createAccount({
    fromPubkey: ownerKeypair.publicKey,
    newAccountPubkey: prizeAccountKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span
    ),
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  let buffer = Buffer.alloc(1000);
  const price = 10000;
  const nowTime = Number((new Date().getTime() / 1000).toFixed(0));
  const startTime = nowTime;
  const endTime = nowTime + 1000000;
  configInstructionLayout.encode(
    {
      variant: 0, // instruction
      total_prize: new BN(`${totalPrize * Math.pow(10, DECIMAL)}`),
      start_time: new BN(startTime),
      end_time: new BN(endTime),
    },
    buffer
  );

  buffer = buffer.slice(0, configInstructionLayout.getSpan(buffer));

  const firstAccountKeypair = new Keypair();
  const secondAccountKeypair = new Keypair();
  const thirdAccountKeypair = new Keypair();

  const initTokenSaleProgramIx = new TransactionInstruction({
    programId: prizeProgramId,
    keys: [
      createAccountInfo(ownerKeypair.publicKey, true, false),
      createAccountInfo(SYSVAR_RENT_PUBKEY, false, false),
      createAccountInfo(TOKEN_PROGRAM_ID, false, false),
    ],
    data: buffer,
  });

  console.log({
    TOKEN_PROGRAM_ID,
    firstAccountKeypair: String(firstAccountKeypair.publicKey),
    secondAccountKeypair: String(secondAccountKeypair.publicKey),
    thirdAccountKeypair: String(thirdAccountKeypair.publicKey),
  });

  //make transaction with several instructions(ix)
  console.log("Send transaction...\n");
  const tx = new Transaction().add(
    createPrizeAccountIx,
    initTokenSaleProgramIx
  );

  await connection.sendTransaction(tx, [ownerKeypair, prizeAccountKeypair], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  //phase1 end

  //wait block update
  await new Promise((resolve) => setTimeout(resolve, 5000));

  //phase2 (check Transaction result is valid)
  await getConfig(prizeAccountKeypair.publicKey, connection);
  console.log(`✨TX successfully finished✨\n`);
};

transaction();
