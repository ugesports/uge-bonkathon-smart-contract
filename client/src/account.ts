import { PublicKey } from "@solana/web3.js";

//@ts-expect-error missing types
import * as BufferLayout from "buffer-layout";

export const TokenSaleAccountLayout = BufferLayout.struct([
  BufferLayout.u8("isInitialized"), //1byte
  BufferLayout.blob(32, "sellerPubkey"), //pubkey(32byte)
  BufferLayout.blob(32, "idoTokenAccountPubkey"), //pubkey(32byte)
  BufferLayout.blob(8, "totalSaleToken"), //8byte
  BufferLayout.blob(8, "price"), //8byte
  BufferLayout.blob(8, "startTime"), //8byte
  BufferLayout.blob(8, "endTime"), //8byte
]);

export interface TokenSaleAccountLayoutInterface {
  [index: string]: number | Uint8Array;
  isInitialized: number;
  sellerPubkey: Uint8Array;
  idoTokenAccountPubkey: Uint8Array;
  totalSaleToken: Uint8Array;
  price: Uint8Array;
  startTime: Uint8Array;
  endTime: Uint8Array;
}

export interface ExpectedTokenSaleAccountLayoutInterface {
  [index: string]: number | PublicKey;
  isInitialized: number;
  sellerPubkey: PublicKey;
  idoTokenAccountPubkey: PublicKey;
  totalSaleToken: number;
  price: number;
  startTime: number;
  endTime: number;
}
