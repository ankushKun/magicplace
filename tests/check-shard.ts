import * as anchor from "@coral-xyz/anchor";

// Direct connection to devnet to check the actual on-chain state
const devnetConnection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
const erConnection = new anchor.web3.Connection("https://devnet.magicblock.app", "confirmed");

// The delegation program ID used by MagicBlock
const DELEGATION_PROGRAM_ID = new anchor.web3.PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

const SHARD_SEED = Buffer.from("shard");
const PROGRAM_ID = new anchor.web3.PublicKey("CHhht9A6W95JYGm3AA1yH34n112uexmrpKqoSwKwfmxE");

function deriveShardPDA(shardX: number, shardY: number): anchor.web3.PublicKey {
  const shardXBytes = Buffer.alloc(2);
  shardXBytes.writeUInt16LE(shardX);
  const shardYBytes = Buffer.alloc(2);
  shardYBytes.writeUInt16LE(shardY);
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [SHARD_SEED, shardXBytes, shardYBytes],
    PROGRAM_ID
  );
  return pda;
}

async function checkShard(shardX: number, shardY: number) {
  console.log(`\n========================================`);
  console.log(`Checking Shard (${shardX}, ${shardY})`);
  console.log(`========================================`);
  
  const shardPDA = deriveShardPDA(shardX, shardY);
  console.log(`PDA: ${shardPDA.toBase58()}`);

  // Check on base layer (devnet)
  console.log(`\n--- Base Layer (Devnet) ---`);
  try {
    const baseAccountInfo = await devnetConnection.getAccountInfo(shardPDA);
    if (baseAccountInfo) {
      console.log(`✓ Account EXISTS on base layer`);
      console.log(`  Owner: ${baseAccountInfo.owner.toBase58()}`);
      console.log(`  Data length: ${baseAccountInfo.data.length} bytes`);
      console.log(`  Lamports: ${baseAccountInfo.lamports}`);
      
      if (baseAccountInfo.owner.equals(DELEGATION_PROGRAM_ID)) {
        console.log(`  Status: DELEGATED (owned by delegation program)`);
      } else if (baseAccountInfo.owner.equals(PROGRAM_ID)) {
        console.log(`  Status: NOT DELEGATED (owned by magicplace program)`);
      } else {
        console.log(`  Status: UNKNOWN owner`);
      }
    } else {
      console.log(`✗ Account NOT FOUND on base layer`);
    }
  } catch (err) {
    console.log(`✗ Error checking base layer: ${err}`);
  }

  // Check on ER
  console.log(`\n--- Ephemeral Rollups (MagicBlock) ---`);
  try {
    const erAccountInfo = await erConnection.getAccountInfo(shardPDA);
    if (erAccountInfo) {
      console.log(`✓ Account EXISTS on ER`);
      console.log(`  Owner: ${erAccountInfo.owner.toBase58()}`);
      console.log(`  Data length: ${erAccountInfo.data.length} bytes`);
    } else {
      console.log(`✗ Account NOT FOUND on ER`);
    }
  } catch (err) {
    console.log(`✗ Error checking ER: ${err}`);
  }
}

async function main() {
  // Check the specific shard mentioned by the user
  await checkShard(651, 1583);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
