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

async function testDelegation() {
  const shardX = 648;
  const shardY = 1584;
  
  console.log(`\n========================================`);
  console.log(`Testing delegation for Shard (${shardX}, ${shardY})`);
  console.log(`========================================`);
  
  const shardPDA = deriveShardPDA(shardX, shardY);
  console.log(`Shard PDA: ${shardPDA.toBase58()}`);
  
  // Check shard exists
  const accountInfo = await devnetConnection.getAccountInfo(shardPDA);
  if (!accountInfo) {
    console.log("Shard does not exist on chain!");
    return;
  }
  console.log(`Shard exists. Owner: ${accountInfo.owner.toBase58()}`);
  console.log(`Data length: ${accountInfo.data.length} bytes`);
  
  // Build the delegate instruction
  console.log("\nBuilding delegate instruction...");
  
  try {
    const delegateIx = await program.methods
      .delegateShard(shardX, shardY)
      .accounts({
        authority: provider.wallet.publicKey,
      })
      .remainingAccounts([
        { pubkey: DEVNET_VALIDATOR, isSigner: false, isWritable: false }
      ])
      .instruction();
    
    console.log("\nDelegate instruction details:");
    console.log(`Program ID: ${delegateIx.programId.toBase58()}`);
    console.log(`\nAccounts (${delegateIx.keys.length}):`);
    delegateIx.keys.forEach((key, i) => {
      console.log(`  ${i}: ${key.pubkey.toBase58()} (writable: ${key.isWritable}, signer: ${key.isSigner})`);
    });
    
    // Try to send the transaction
    console.log("\nSending transaction...");
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 200_000,
    });
    
    const tx = new Transaction().add(priorityFeeIx).add(delegateIx);
    tx.feePayer = provider.wallet.publicKey;
    tx.recentBlockhash = (await devnetConnection.getLatestBlockhash()).blockhash;
    
    const signedTx = await provider.wallet.signTransaction(tx);
    const txSig = await devnetConnection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
    });
    
    console.log(`Transaction sent: ${txSig}`);
    
    const confirmation = await devnetConnection.confirmTransaction(txSig, "confirmed");
    if (confirmation.value.err) {
      console.log(`Transaction FAILED:`, confirmation.value.err);
      
      // Get transaction details
      const txDetails = await devnetConnection.getTransaction(txSig, {
        maxSupportedTransactionVersion: 0,
      });
      console.log("\nTransaction logs:");
      txDetails?.meta?.logMessages?.forEach(log => console.log(`  ${log}`));
    } else {
      console.log("Transaction SUCCEEDED!");
    }
    
  } catch (err) {
    console.error("Error:", err);
  }
}

testDelegation().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
