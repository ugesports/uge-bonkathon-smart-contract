import * as web3 from "@solana/web3.js";
import * as borsh from "@project-serum/borsh";
import * as fs from "fs";
import base58 from "bs58";
import dotenv from "dotenv";
import { BN } from "bn.js";
import {
  AccountLayout,
  TOKEN_PROGRAM_ID,
  createInitializeAccountInstruction,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { PublicKey } from "@metaplex-foundation/js";
dotenv.config();

let PDAPublicKey: web3.PublicKey;
const TokenPubkey = new web3.PublicKey(
  "DPZH9bpvpWkBxtYsf3wWJWPDk2frn1KCbEeyKxZTVJ6V"
);
const StakeProgramId = new web3.PublicKey(
  "AaxErDLdEZw9WgtjAHeB8Lkpbn4KxCN9o7nzmePdcugf"
);

function initializeSignerKeypair(): web3.Keypair {
  // Onwer keypair
  const ownerKeypair = web3.Keypair.fromSecretKey(
    base58.decode(process.env.STAKER_PRIVATE_KEY!)
  );
  console.log("ownerKeypair:", ownerKeypair.publicKey.toBase58());
  return ownerKeypair;
}

const stakeLayout = borsh.struct([
  borsh.u8("is_initialized"),
  borsh.u64("duration"),
  borsh.u64("stake_amount"),
  borsh.u64("start_stake_time"),
  borsh.u64("end_stake_time"),
  borsh.bool("is_claimed"),
]);

const stakeInstructionLayout = borsh.struct([
  borsh.u8("variant"),
  borsh.u64("duration"),
  borsh.u64("stake_amount"),
]);

export const getStake = async (
  signer: web3.PublicKey,
  connection: web3.Connection
) => {
  const customAccount = await connection.getAccountInfo(signer);
  console.log({ customAccount });
  if (customAccount) {
    const data = stakeLayout.decode(customAccount ? customAccount.data : null);
    console.log(data);
    const stakeInfo = {
      duration: data["duration"].toString(),
      stake_amount: data["stake_amount"].toString(),
      is_claimed: data["is_claimed"].toString(),
      start_stake_time: data["start_stake_time"].toString(),
      end_stake_time: data["end_stake_time"].toString(),
    };
    console.log(stakeInfo);
    return stakeInfo;
  }
};

async function initContract(staker: web3.Keypair, connection: web3.Connection) {
  const RewardPoolAccountKeypair = new web3.Keypair();

  const createRewardPoolTokenAccountIx = web3.SystemProgram.createAccount({
    fromPubkey: staker.publicKey,
    newAccountPubkey: RewardPoolAccountKeypair.publicKey,
    lamports: await connection.getMinimumBalanceForRentExemption(
      AccountLayout.span
    ),
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  const initRewardPoolTokenAccountIx = createInitializeAccountInstruction(
    RewardPoolAccountKeypair.publicKey,
    TokenPubkey,
    staker.publicKey
  );

  const tx = new web3.Transaction().add(
    createRewardPoolTokenAccountIx,
    initRewardPoolTokenAccountIx
  );

  await connection.sendTransaction(tx, [staker, RewardPoolAccountKeypair], {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log(RewardPoolAccountKeypair.publicKey);
}

async function stake(
  staker: web3.Keypair,
  programId: web3.PublicKey,
  connection: web3.Connection
) {
  let buffer = Buffer.alloc(1000);
  stakeInstructionLayout.encode(
    {
      variant: 0,
      duration: new BN(7),
      stake_amount: new BN(1 * 10 ** 9),
    },
    buffer
  );

  buffer = buffer.slice(0, stakeInstructionLayout.getSpan(buffer));

  const [pda_staker] = await web3.PublicKey.findProgramAddress(
    [staker.publicKey.toBuffer(), Buffer.from("stake")],
    programId
  );

  console.log("PDA Staker is:", pda_staker.toBase58());
  PDAPublicKey = pda_staker;

  const stakerAta = getAssociatedTokenAddressSync(
    TokenPubkey,
    staker.publicKey
  );
  console.log({ stakerAta });
  const ataStakerAccount = await connection.getAccountInfo(stakerAta);
  console.log({ ataStakerAccount });
  if (!ataStakerAccount) {
    console.log("create ataStakerAccount", stakerAta);
    await getOrCreateAssociatedTokenAccount(
      connection,
      staker,
      TokenPubkey,
      staker.publicKey
    );
  }

  const RewardPoolAccount = new web3.PublicKey(
    "Hz8fB5cs7jFuAZkUDMX1CEx3aZdjagdvAiE88JGtaSaW"
  );

  const [pda_program] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake")],
    StakeProgramId
  );

  const prizePoolPublic = new web3.PublicKey(
    "2XNCcbF4UXbAQY6pDmHU4b6redJ9xiVMUr6EGh8PiadR"
  );
  const PrizePoolAta = getAssociatedTokenAddressSync(
    TokenPubkey,
    prizePoolPublic
  );
  console.log({ PrizePoolAta });
  const transaction = new web3.Transaction();

  const instruction = new web3.TransactionInstruction({
    programId: programId,
    data: buffer,
    keys: [
      {
        pubkey: staker.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda_staker,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: stakerAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: RewardPoolAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: pda_program,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: PrizePoolAta,
        isSigner: false,
        isWritable: true,
      },
    ],
  });

  transaction.add(instruction);
  const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
    staker,
  ]);
  console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

async function main() {
  const signer = initializeSignerKeypair();

  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

  // await initContract(signer, connection);
  await stake(signer, StakeProgramId, connection);
  await getStake(PDAPublicKey, connection);
}

main()
  .then(() => {
    console.log("Finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
