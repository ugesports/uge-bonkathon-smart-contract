import * as web3 from "@solana/web3.js";
import base58 from "bs58";
import dotenv from "dotenv";
import * as borsh from "@project-serum/borsh";
import { PublicKey } from "@metaplex-foundation/js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

dotenv.config();

export const StakeProgramId = new web3.PublicKey(
  "AaxErDLdEZw9WgtjAHeB8Lkpbn4KxCN9o7nzmePdcugf"
);

export const TokenPubkey = new web3.PublicKey(
  "9cBLFeaq8oNTFnRBPpa8TWC1kWc352UVneQmy4TeuqBD"
);

export const RewardPoolAccount = new web3.PublicKey(
  "CssojHYYWXKXmrPqCCFWxi4x26oHtGdVk7zMnZcMSLAZ"
);

export function initializeSignerKeypair(): web3.Keypair {
  const ownerKeypair = web3.Keypair.fromSecretKey(
    base58.decode(process.env.STAKER_PRIVATE_KEY!)
  );
  console.log("Owner publickey:", ownerKeypair.publicKey.toBase58());
  return ownerKeypair;
}

export function getProgramPda() {
  const [program_pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake")],
    StakeProgramId
  );

  console.log({ program_pda });
  return program_pda;
}

export function getPrizePoolPda() {
  const prizePoolPublic = new web3.PublicKey(
    "2XNCcbF4UXbAQY6pDmHU4b6redJ9xiVMUr6EGh8PiadR"
  );
  const PrizePoolAta = getAssociatedTokenAddressSync(
    TokenPubkey,
    prizePoolPublic
  );
  console.log({ PrizePoolAta });

  return PrizePoolAta;
}

export async function getUserStakePda(stakerPublic: web3.PublicKey) {
  const [pda_staker] = await web3.PublicKey.findProgramAddress(
    [stakerPublic.toBuffer(), Buffer.from("stake")],
    StakeProgramId
  );

  console.log("PDA Staker is:", pda_staker.toBase58());
  return pda_staker;
}

export const stakeLayout = borsh.struct([
  borsh.u8("is_initialized"),
  borsh.u64("duration"),
  borsh.u64("stake_amount"),
  borsh.u64("reward_stake_amount"),
  borsh.u64("start_stake_time"),
  borsh.u64("end_stake_time"),
  borsh.bool("is_claimed"),
]);

export const getStake = async (
  signer: web3.PublicKey,
  connection: web3.Connection
) => {
  const customAccount = await connection.getAccountInfo(signer);
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
