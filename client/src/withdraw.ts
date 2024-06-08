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
import {
  RewardPoolAccount,
  TokenPubkey,
  getProgramPda,
  getStake,
  getUserStakePda,
  initializeSignerKeypair,
} from "./util";
dotenv.config();

const withdrawInstructionLayout = borsh.struct([borsh.u8("variant")]);

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

  const stakerPda = await getUserStakePda(staker.publicKey);
  console.log("PDA Staker is:", stakerPda.toBase58());

  const stakerAta = getAssociatedTokenAddressSync(
    TokenPubkey,
    staker.publicKey
  );
  console.log({ stakerAta });

  const ProgramPDA = getProgramPda();
  console.log({ ProgramPDA });

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
        pubkey: stakerPda,
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
        pubkey: ProgramPDA,
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

  const PDAPublicKey = await getUserStakePda(signer.publicKey);
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
