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

import {
  AccountLayout,
  createInitializeAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import base58 = require("bs58");

const TokenPubkey = new PublicKey(
  "DPZH9bpvpWkBxtYsf3wWJWPDk2frn1KCbEeyKxZTVJ6V"
);
const StakeProgramId = new PublicKey(
  "AaxErDLdEZw9WgtjAHeB8Lkpbn4KxCN9o7nzmePdcugf"
);

export const createAccountInfo = (
  pubkey: PublicKey,
  isSigner: boolean,
  isWritable: boolean
) => {
  return {
    pubkey: pubkey,
    isSigner: isSigner,
    isWritable: isWritable,
  };
};

const transaction = async () => {
  const configInstructionLayout = borsh.struct([borsh.u8("variant")]);

  //phase1 (setup Transaction & send Transaction)
  console.log("Setup Transaction");
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const ownerKeypair = Keypair.fromSecretKey(
    base58.decode(process.env.STAKER_PRIVATE_KEY!)
  );

  const rewardAccountTokenKeypair = new Keypair();
  const createRewardAccountTokenIx = SystemProgram.createAccount({
    fromPubkey: ownerKeypair.publicKey,
    newAccountPubkey: rewardAccountTokenKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span
    ),
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  const initIdoTokenAccountIx = createInitializeAccountInstruction(
    rewardAccountTokenKeypair.publicKey,
    TokenPubkey,
    ownerKeypair.publicKey
  );

  let buffer = Buffer.alloc(1000);
  configInstructionLayout.encode(
    {
      variant: 0, // instruction
    },
    buffer
  );

  buffer = buffer.slice(0, configInstructionLayout.getSpan(buffer));

  const initStakeTokenProgramIx = new TransactionInstruction({
    programId: StakeProgramId,
    keys: [
      createAccountInfo(ownerKeypair.publicKey, true, false),
      createAccountInfo(rewardAccountTokenKeypair.publicKey, false, true),
      createAccountInfo(TOKEN_PROGRAM_ID, false, false),
    ],
    data: buffer,
  });

  console.log({
    TOKEN_PROGRAM_ID,
    TokenPubkey: String(TokenPubkey),
    rewardAccountTokenKeypair: String(rewardAccountTokenKeypair.publicKey),
    ownerKeypair: String(ownerKeypair.publicKey),
    initStakeTokenProgramIx,
  });

  //make transaction with several instructions(ix)
  console.log("Send transaction...\n");
  const tx = new Transaction().add(
    createRewardAccountTokenIx,
    initIdoTokenAccountIx,
    initStakeTokenProgramIx
  );

  await connection.sendTransaction(
    tx,
    [ownerKeypair, rewardAccountTokenKeypair],
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );
  //phase1 end
  console.log(`✨TX successfully finished✨\n`);
};

transaction();
