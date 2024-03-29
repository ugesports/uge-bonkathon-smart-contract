import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { updateEnv } from "./utils";

const dotenv = require("dotenv");
const bs58 = require("bs58");

dotenv.config();

const transaction = async () => {
  const motherWallet = Keypair.fromSecretKey(
    bs58.decode(process.env.SELLER_PRIVATE_KEY!)
  );
  const decimal = 9;
  const supply = 1 * 10 ** 9;
  const name = "Wukong";
  const symbol = "WUKONG";
  const uri = "https://arweave.net/-0ye6AB8I9sWqWF5Zq0iSOrHELvd2D0Ik1NEkiHU49I";

  const mintKeypair = Keypair.generate();

  const connection = new Connection(clusterApiUrl("devnet"), {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 9000000,
  });

  console.log("Mother wallet address: ", motherWallet.publicKey.toBase58());

  const mint_rent = await getMinimumBalanceForRentExemptMint(connection);
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      PROGRAM_ID.toBuffer(),
      mintKeypair.publicKey.toBuffer(),
    ],
    PROGRAM_ID
  );

  const tokenATA = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    motherWallet.publicKey
  );
  const tokenMetadata = {
    name: name,
    symbol: symbol,
    uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const createNewTokenTransaction = new Transaction().add(
    // Create pda account for mint address for save data
    SystemProgram.createAccount({
      fromPubkey: motherWallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: mint_rent,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimal,
      motherWallet.publicKey,
      motherWallet.publicKey,
      TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      motherWallet.publicKey,
      tokenATA,
      motherWallet.publicKey,
      mintKeypair.publicKey
    ),
    createMintToInstruction(
      mintKeypair.publicKey,
      tokenATA,
      motherWallet.publicKey,
      supply * Math.pow(10, decimal)
    ),
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mintKeypair.publicKey,
        mintAuthority: motherWallet.publicKey,
        payer: motherWallet.publicKey,
        updateAuthority: motherWallet.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: tokenMetadata,
          isMutable: true,
          //   collectionDetails: { __kind: "V1" },
          collectionDetails: { __kind: "V1", size: 0 },
        },
      }
    ),
    createSetAuthorityInstruction(
      mintKeypair.publicKey,
      motherWallet.publicKey,
      AuthorityType.MintTokens,
      null
    )
    // createBurnInstruction(
    //   mintKeypair.publicKey,
    //   motherWallet.publicKey,
    //   motherWallet.publicKey,
    //   33 * Math.pow(10, decimal)
    // )
  );

  const result = await sendAndConfirmTransaction(
    connection,
    createNewTokenTransaction,
    [motherWallet, mintKeypair]
  );

  console.log("Token address: ", mintKeypair.publicKey.toBase58());
  console.log("Transaction hash:", result);

  console.log(`✨TX successfully finished✨\n`);

  process.env.SELLER_TOKEN_ACCOUNT_PUBKEY = tokenATA.toString();
  process.env.TOKEN_PUBKEY = mintKeypair.publicKey.toBase58();
  updateEnv();
};

transaction();
