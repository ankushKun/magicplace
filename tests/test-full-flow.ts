import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Magicplace } from "../target/types/magicplace";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";

// Connections
const devnetConnection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");

// Program IDs
const PROGRAM_ID = new anchor.web3.PublicKey("CHhht9A6W95JYGm3AA1yH34n112uexmrpKqoSwKwfmxE");
const DELEGATION_PROGRAM_ID = new anchor.web3.PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const DEVNET_VALIDATOR = new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57");

const SHARD_SEED = Buffer.from("shard");

// Load the program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.Magicplace as Program<Magicplace>;

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

async function testFullFlow() {
  // Use a random shard that definitely doesn't exist
  const shardX = Math.floor(Math.random() * 100);
  const shardY = Math.floor(Math.random() * 100);
  
  console.log(`\n========================================`);
  console.log(`Testing FULL flow for NEW Shard (${shardX}, ${shardY})`);
  console.log(`========================================`);
  
  const shardPDA = deriveShardPDA(shardX, shardY);
  console.log(`Shard PDA: ${shardPDA.toBase58()}`);
  
  // Check shard doesn't exist
  let accountInfo = await devnetConnection.getAccountInfo(shardPDA);
  if (accountInfo) {
    console.log("Shard already exists, picking another...");
    return;
  }
  console.log("✓ Shard does not exist - proceeding with initialization");
  
  // STEP 1: Initialize
  console.log("\n--- STEP 1: Initialize Shard ---");
  try {
    const initTx = await program.methods
      .initializeShard(shardX, shardY)
      .accounts({
        authority: provider.wallet.publicKey,
      })
      .rpc();
    console.log(`Initialize TX: ${initTx}`);
    
    // Wait for confirmation
    await devnetConnection.confirmTransaction(initTx, "confirmed");
    console.log("✓ Initialize confirmed");
    
    // Verify
    accountInfo = await devnetConnection.getAccountInfo(shardPDA);
    console.log(`Shard now exists. Owner: ${accountInfo?.owner.toBase58()}`);
  } catch (err) {
    console.error("Initialize failed:", err);
    return;
  }
  
  // Wait a bit
  console.log("\nWaiting 3 seconds for state to settle...");
  await new Promise(r => setTimeout(r, 3000));
  
  // STEP 2: Delegate  
  console.log("\n--- STEP 2: Delegate Shard ---");
  try {
    const delegateTx = await program.methods
      .delegateShard(shardX, shardY)
      .accounts({
        authority: provider.wallet.publicKey,
      })
      .remainingAccounts([
        { pubkey: DEVNET_VALIDATOR, isSigner: false, isWritable: false }
      ])
      .rpc({ skipPreflight: true });
    
    console.log(`Delegate TX: ${delegateTx}`);
    
    const confirmation = await devnetConnection.confirmTransaction(delegateTx, "confirmed");
    if (confirmation.value.err) {
      console.log(`Delegate FAILED:`, confirmation.value.err);
      
      // Get details
      const txDetails = await devnetConnection.getTransaction(delegateTx, {
        maxSupportedTransactionVersion: 0,
      });
      console.log("Logs:");
      txDetails?.meta?.logMessages?.forEach(log => console.log(`  ${log}`));
    } else {
      console.log("✓ Delegate confirmed!");
      
      // Verify ownership changed
      accountInfo = await devnetConnection.getAccountInfo(shardPDA);
      console.log(`Shard owner now: ${accountInfo?.owner.toBase58()}`);
      
      if (accountInfo?.owner.equals(DELEGATION_PROGRAM_ID)) {
        console.log("\n🎉 SUCCESS! Shard is now delegated!");
      }
    }
  } catch (err) {
    console.error("Delegate failed:", err);
  }
}

testFullFlow().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
