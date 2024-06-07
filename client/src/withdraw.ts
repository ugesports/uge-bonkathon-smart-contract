import * as web3 from "@solana/web3.js";
import * as borsh from "@project-serum/borsh";
import * as fs from "fs";
import base58 from "bs58";
import dotenv from "dotenv";
import { BN } from "bn.js";
import { PublicKey } from "@metaplex-foundation/js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
dotenv.config();

let PDAPublicKey: web3.PublicKey;
const StakeProgramId = new web3.PublicKey(
  "AaxErDLdEZw9WgtjAHeB8Lkpbn4KxCN9o7nzmePdcugf"
);

const TokenPubkey = new web3.PublicKey(
  "DPZH9bpvpWkBxtYsf3wWJWPDk2frn1KCbEeyKxZTVJ6V"
);

function initializeSignerKeypair(): web3.Keypair {
  // Onwer keypair
  const ownerKeypair = web3.Keypair.fromSecretKey(
    base58.decode(process.env.STAKER_PRIVATE_KEY!)
  );
  return ownerKeypair;
}

const stakeLayout = borsh.struct([
  borsh.u8("is_initialized"),
  borsh.u64("duration"),
  borsh.u64("stake_amount"),
  borsh.u64("reward_stake_amount"),
  borsh.u64("start_stake_time"),
  borsh.u64("end_stake_time"),
  borsh.bool("is_claimed"),
]);

const withdrawInstructionLayout = borsh.struct([borsh.u8("variant")]);

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
      reward_stake_amount: data["reward_stake_amount"].toString(),
      is_claimed: data["is_claimed"].toString(),
      start_stake_time: data["start_stake_time"].toString(),
      end_stake_time: data["end_stake_time"].toString(),
    };
    console.log(stakeInfo);
    return stakeInfo;
  }
};

async function withdraw(
  staker: web3.Keypair,
  programId: web3.PublicKey,
  connection: web3.Connection
) {
  let buffer = Buffer.alloc(1000);
  withdrawInstructionLayout.encode(
    {
      variant: 1,
    },
    buffer
  );

  buffer = buffer.slice(0, withdrawInstructionLayout.getSpan(buffer));

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

  const [pda_program] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake")],
    StakeProgramId
  );

  const RewardPoolAccount = new web3.PublicKey(
    "6eQSgiGEQZPHwR12NAttkNEaAHExXRvkANj5vYGReH3g"
  );

  console.log({ pda_program });

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
        pubkey: stakerAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
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
        pubkey: RewardPoolAccount,
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

  const PDA = new PublicKey("5RyEKLZ7ov5fNiCz6SdqmuaZFW18RsK2Q36RTcbRvYU2");
  const prizeProgramId = new web3.PublicKey(
    "AaxErDLdEZw9WgtjAHeB8Lkpbn4KxCN9o7nzmePdcugf"
  );
  // await getStake(PDAPublicKey, connection);
  await withdraw(signer, prizeProgramId, connection);
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
