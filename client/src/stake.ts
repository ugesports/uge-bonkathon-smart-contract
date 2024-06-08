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
import {
  RewardPoolAccount,
  StakeProgramId,
  TokenPubkey,
  getPrizePoolPda,
  getProgramPda,
  getStake,
  getUserStakePda,
  initializeSignerKeypair,
} from "./util";
dotenv.config();

const stakeInstructionLayout = borsh.struct([
  borsh.u8("variant"),
  borsh.u64("duration"),
  borsh.u64("stake_amount"),
]);

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

  const ProgramPda = getProgramPda();

  const initRewardPoolTokenAccountIx = createInitializeAccountInstruction(
    RewardPoolAccountKeypair.publicKey,
    TokenPubkey,
    ProgramPda
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
      stake_amount: new BN(2 * 10 ** 9),
    },
    buffer
  );
  buffer = buffer.slice(0, stakeInstructionLayout.getSpan(buffer));

  const stakerPDA = await getUserStakePda(staker.publicKey);

  const stakerAta = getAssociatedTokenAddressSync(
    TokenPubkey,
    staker.publicKey
  );
  console.log({ stakerAta });
  const ataStakerAccount = await connection.getAccountInfo(stakerAta);
  console.log({ ataStakerAccount });
  if (!ataStakerAccount) {
    await getOrCreateAssociatedTokenAccount(
      connection,
      staker,
      TokenPubkey,
      staker.publicKey
    );
  }

  const ProgramPDA = getProgramPda();
  const PrizePoolAta = getPrizePoolPda();

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
        pubkey: stakerPDA,
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
        pubkey: ProgramPDA,
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
  const PDAPublicKey = await getUserStakePda(signer.publicKey);

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
