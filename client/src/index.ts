import * as web3 from "@solana/web3.js";
import * as borsh from "@project-serum/borsh";
import * as fs from "fs";
import base58 = require("bs58");
import dotenv from "dotenv";
dotenv.config();

function initializeSignerKeypair(): web3.Keypair {
  // Onwer keypair
  const ownerKeypair = web3.Keypair.fromSecretKey(
    base58.decode(process.env.PRIVATE_KEY!)
  );
  return ownerKeypair;
}

const movieInstructionLayout = borsh.struct([
  borsh.u8("variant"),
  borsh.str("title"),
  borsh.u8("rating"),
  borsh.str("description"),
]);

export const getConfig = async (
  signer: web3.PublicKey,
  connection: web3.Connection
) => {
  const customAccount = await connection.getAccountInfo(signer);
  console.log({ customAccount });
  if (customAccount) {
    const data = movieInstructionLayout.decode(
      customAccount ? customAccount.data : null
    );
    const config = {
      title: data["title"].toString(),
      rating: data["rating"].toString(),
      description: data["description"].toString(),
    };
    console.log(config);
    return config;
  }
};

async function airdropSolIfNeeded(
  signer: web3.Keypair,
  connection: web3.Connection
) {
  const balance = await connection.getBalance(signer.publicKey);
  console.log("Current balance is", balance);
  if (balance < web3.LAMPORTS_PER_SOL) {
    console.log("Airdropping 1 SOL...");
    await connection.requestAirdrop(signer.publicKey, web3.LAMPORTS_PER_SOL);
  }
}

async function initConfig(
  signer: web3.Keypair,
  programId: web3.PublicKey,
  connection: web3.Connection
) {
  let buffer = Buffer.alloc(1000);
  const movieTitle = `config-prize`;
  movieInstructionLayout.encode(
    {
      variant: 0,
      title: movieTitle,
      rating: 5,
      description: "A great movie",
    },
    buffer
  );

  buffer = buffer.slice(0, movieInstructionLayout.getSpan(buffer));

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
  let buffer = Buffer.alloc(1000);
  const movieTitle = `config-prize`;

  const [pda] = await web3.PublicKey.findProgramAddress(
    [signer.publicKey.toBuffer(), Buffer.from(movieTitle)],
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

  let updateBuffer = Buffer.alloc(1000);

  movieInstructionLayout.encode(
    {
      variant: 1,
      title: movieTitle,
      rating: 2,
      description: "A great movie update",
    },
    updateBuffer
  );

  updateBuffer = updateBuffer.slice(
    0,
    movieInstructionLayout.getSpan(updateBuffer)
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
  await airdropSolIfNeeded(signer, connection);

  const movieProgramId = new web3.PublicKey(
    "EqAa2wj97MMqN6ViinJw1oJ6dQNTNnTMEMMjBMwgqqQ6"
  );
  //   await initConfig(signer, movieProgramId, connection);
  //   await getConfig(signer.publicKey, connection);

  await updateConfig(signer, movieProgramId, connection);
  //   await getConfig(signer.publicKey, connection);
  await getConfig(
    new web3.PublicKey("9mrNqWg2hQTDviu5s6p6Xqzb5A9yPDUEF1ABkkrWjekx"),
    connection
  );
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
