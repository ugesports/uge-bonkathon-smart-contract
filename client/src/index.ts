import * as web3 from "@solana/web3.js";
import * as borsh from "@project-serum/borsh";
import * as fs from "fs";
import base58 from "bs58";
import dotenv from "dotenv";
import { BN } from "bn.js";
dotenv.config();

function initializeSignerKeypair(): web3.Keypair {
  // Onwer keypair
  const ownerKeypair = web3.Keypair.fromSecretKey(
    base58.decode(process.env.PRIVATE_KEY!)
  );
  return ownerKeypair;
}

const configInstructionLayout = borsh.struct([
  borsh.u8("variant"),
  borsh.u64("total_prize"),
  borsh.u64("first_prize"),
  borsh.u64("second_prize"),
  borsh.u64("third_prize"),
  borsh.publicKey("first_account"),
  borsh.publicKey("second_account"),
  borsh.publicKey("third_account"),
  borsh.bool("is_first_claimed"),
  borsh.bool("is_second_claimed"),
  borsh.bool("is_third_claimed"),
  borsh.u64("start_time"),
  borsh.u64("end_time"),
]);

export const getConfig = async (
  signer: web3.PublicKey,
  connection: web3.Connection
) => {
  const customAccount = await connection.getAccountInfo(signer);
  // console.log({ customAccount });
  if (customAccount) {
    const data = configInstructionLayout.decode(
      customAccount ? customAccount.data : null
    );
    const config = {
      total_prize: data["total_prize"].toString(),
      first_prize: data["first_prize"].toString(),
      second_prize: data["second_prize"].toString(),
      third_prize: data["third_prize"].toString(),
      first_account: data["first_account"].toString(),
      second_account: data["second_account"].toString(),
      third_account: data["third_account"].toString(),
      is_first_claimed: data["is_first_claimed"].toString(),
      is_second_claimed: data["is_second_claimed"].toString(),
      is_third_claimed: data["is_third_claimed"].toString(),
      start_time: data["start_time"].toString(),
      end_time: data["end_time"].toString(),
    };
    console.log(config);
    return config;
  }
};

async function initConfig(
  signer: web3.Keypair,
  programId: web3.PublicKey,
  connection: web3.Connection
) {
  const accountTest = new web3.Keypair();
  const nowTime = Number((new Date().getTime() / 1000).toFixed(0));
  const startTime = nowTime;
  const endTime = nowTime + 1000000;

  let buffer = Buffer.alloc(1000);
  configInstructionLayout.encode(
    {
      variant: 0,
      total_prize: new BN(10000),
      first_prize: new BN(30000),
      second_prize: new BN(40000),
      third_prize: new BN(5000),
      first_account: accountTest.publicKey,
      second_account: accountTest.publicKey,
      third_account: accountTest.publicKey,
      is_first_claimed: false,
      is_second_claimed: false,
      is_third_claimed: false,
      start_time: new BN(startTime),
      end_time: new BN(endTime),
    },
    buffer
  );

  buffer = buffer.slice(0, configInstructionLayout.getSpan(buffer));

  const [pda] = await web3.PublicKey.findProgramAddress(
    [signer.publicKey.toBuffer(), Buffer.from("config-prize")],
    programId
  );

  console.log("PDA is:", pda.toBase58());

  const transaction = new web3.Transaction();

  const instruction = new web3.TransactionInstruction({
    programId: programId,
    data: buffer,
    keys: [
      {
        pubkey: signer.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  });

  transaction.add(instruction);
  const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
    signer,
  ]);
  console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

async function updateConfig(
  signer: web3.Keypair,
  programId: web3.PublicKey,
  connection: web3.Connection
) {
  const initPublickey = new web3.PublicKey(
    "1nc1nerator11111111111111111111111111111111"
  );
  const nowTime = Number((new Date().getTime() / 1000).toFixed(0));
  const startTime = nowTime;
  const endTime = nowTime + 1000000;

  let updateBuffer = Buffer.alloc(1000);
  const decimal = 10 ** 9;
  configInstructionLayout.encode(
    {
      variant: 1,
      total_prize: new BN(10 * decimal),
      first_prize: new BN(5 * decimal),
      second_prize: new BN(3 * decimal),
      third_prize: new BN(2 * decimal),
      first_account: initPublickey,
      second_account: initPublickey,
      third_account: new web3.PublicKey(
        "9awnhANDAD7CajDNxvzK5MzGfwXLK7f1JHzBnknXrz3p"
      ),
      is_first_claimed: false,
      is_second_claimed: false,
      is_third_claimed: false,
      start_time: new BN(startTime),
      end_time: new BN(endTime),
    },
    updateBuffer
  );

  const [pda] = await web3.PublicKey.findProgramAddress(
    [signer.publicKey.toBuffer(), Buffer.from("config-prize")],
    programId
  );

  console.log("PDA is:", pda.toBase58());

  const transaction = new web3.Transaction();

  updateBuffer = updateBuffer.slice(
    0,
    configInstructionLayout.getSpan(updateBuffer)
  );

  const updateInstruction = new web3.TransactionInstruction({
    programId: programId,
    data: updateBuffer,
    keys: [
      {
        pubkey: signer.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  });
  transaction.add(updateInstruction);

  const tx = await web3.sendAndConfirmTransaction(connection, transaction, [
    signer,
  ]);
  console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

async function main() {
  const signer = initializeSignerKeypair();

  const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

  const PDA = new web3.PublicKey("aXRun3U7XHyri96YVTAeuPccUcBcEkJPTN1UwdHcFkQ");
  const prizeProgramId = new web3.PublicKey(
    "6T79HdAoKWtBRjAngMWcCeVnrwFJhPJ4bWvwFsQzfv8z"
  );
  // await initConfig(signer, prizeProgramId, connection);
  await getConfig(PDA, connection);

  await updateConfig(signer, prizeProgramId, connection);
  await getConfig(PDA, connection);
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
