import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  TokenSaleAccountLayoutInterface,
  ExpectedTokenSaleAccountLayoutInterface,
} from "./account";
import BN = require("bn.js");
import fs = require("fs");
import * as borsh from "@project-serum/borsh";
const { getAccount, getMint } = require("@solana/spl-token");

const envItems = [
  "CUSTOM_PROGRAM_ID",
  "SELLER_PUBLIC_KEY",
  "SELLER_PRIVATE_KEY",
  "BUYER_PUBLIC_KEY",
  "BUYER_PRIVATE_KEY",
  "TOKEN_PUBKEY",
  "SELLER_TOKEN_ACCOUNT_PUBKEY",
  "IDO_TOKEN_ACCOUNT_PUBKEY",
  "TOKEN_SALE_PROGRAM_ACCOUNT_PUBKEY",
  "IDO_CONFIG_ACCOUNT_PUBKEY",
];

export function updateEnv() {
  const eol = "\n";
  const envContents = envItems
    .map((item) => `${item}=${process.env[item]}`)
    .join(eol);
  fs.writeFileSync(".env", envContents);
}

export const getKeypair = (publicKey: string, privateKey: Uint8Array) =>
  new Keypair({
    publicKey: new PublicKey(publicKey).toBytes(),
    secretKey: privateKey,
  });

export const getTokenBalance = async (
  pubkey: PublicKey,
  connection: Connection
) => {
  return parseInt(
    (await connection.getTokenAccountBalance(pubkey)).value.amount
  );
};

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

export const getConfig = async (signer: PublicKey, connection: Connection) => {
  const borshConfigSchema = borsh.struct([
    borsh.bool("is_initialized"),
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

  const customAccount = await connection.getAccountInfo(signer);
  console.log({ customAccount });
  if (customAccount) {
    const data = borshConfigSchema.decode(
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

export const getIdoConfig = async (
  signer: PublicKey,
  connection: Connection
) => {
  const borshConfigSchema = borsh.struct([
    borsh.bool("is_initialized"),
    borsh.u64("total_sale_token"),
    borsh.u64("current_sale_token"),
    borsh.u64("total_sale_sol"),
    borsh.u64("current_sale_sol"),
  ]);

  const customAccount = await connection.getAccountInfo(signer);
  if (customAccount) {
    const data = borshConfigSchema.decode(
      customAccount ? customAccount.data : null
    );
    const config = {
      total_sale_token: +data["total_sale_token"].toString() / LAMPORTS_PER_SOL,
      current_sale_token:
        +data["current_sale_token"].toString() / LAMPORTS_PER_SOL,
      total_sale_sol: +data["total_sale_sol"].toString() / LAMPORTS_PER_SOL,
      current_sale_sol: +data["current_sale_sol"].toString() / LAMPORTS_PER_SOL,
    };
    console.log(config);
    return config;
  }
};

export const checkAccountInitialized = async (
  connection: Connection,
  customAccountPubkey: PublicKey
) => {
  const customAccount = await connection.getAccountInfo(customAccountPubkey);

  if (customAccount === null || customAccount.data.length === 0) {
    console.log("Account of custom program has not been initialized properly");
    process.exit(1);
  }

  return customAccount;
};

export const checkAccountDataIsValid = (
  customAccountData: TokenSaleAccountLayoutInterface,
  expectedCustomAccountState: ExpectedTokenSaleAccountLayoutInterface
) => {
  const keysOfAccountData = Object.keys(customAccountData);
  const data: { [char: string]: string } = {};

  keysOfAccountData.forEach((key) => {
    const value = customAccountData[key];
    const expectedValue = expectedCustomAccountState[key];

    //PublicKey
    if (value instanceof Uint8Array && expectedValue instanceof PublicKey) {
      if (!new PublicKey(value).equals(expectedValue)) {
        console.log(`${key} is not matched expected one`);
        process.exit(1);
      }
    } else if (
      value instanceof Uint8Array &&
      typeof expectedValue === "number"
    ) {
      //value is undefined
      if (!value) {
        console.log(`${key} flag has not been set`);
        process.exit(1);
      }

      //value is not matched expected one.
      const isBufferSame = Buffer.compare(
        value,
        Buffer.from(new BN(expectedValue).toArray("le", value.length))
      );

      if (isBufferSame !== 0) {
        console.log(
          `[${key}] : expected value is ${expectedValue}, but current value is ${value}`
        );
        process.exit(1);
      }
    }

    data[key] = expectedValue.toString();
  });
  console.table([data]);
};

export const getTokenBalanceSpl = async (
  connection: Connection,
  tokenAccount: PublicKey
) => {
  const info = await getAccount(connection, tokenAccount);
  const amount = Number(info.amount);
  const mint = await getMint(connection, info.mint);
  const balance = amount / 10 ** mint.decimals;
  console.log("Balance (using Solana-Web3.js): ", balance);
  return balance;
};
