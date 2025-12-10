import * as anchor from "@coral-xyz/anchor";

// Direct connection to devnet
const devnetConnection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");

async function checkTx(signature: string) {
  console.log(`\n========================================`);
  console.log(`Checking Transaction: ${signature.slice(0, 20)}...`);
  console.log(`========================================`);

  try {
    const txInfo = await devnetConnection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (txInfo) {
      console.log(`✓ Transaction FOUND on devnet`);
      console.log(`  Slot: ${txInfo.slot}`);
      console.log(`  Block Time: ${txInfo.blockTime ? new Date(txInfo.blockTime * 1000).toISOString() : 'N/A'}`);
      console.log(`  Fee: ${txInfo.meta?.fee} lamports`);
      
      if (txInfo.meta?.err) {
        console.log(`  ✗ Transaction FAILED with error:`, txInfo.meta.err);
      } else {
        console.log(`  ✓ Transaction SUCCEEDED`);
      }
      
      // Log any log messages
      if (txInfo.meta?.logMessages && txInfo.meta.logMessages.length > 0) {
        console.log(`\n  Logs:`);
        txInfo.meta.logMessages.forEach((log, i) => {
          console.log(`    ${log}`);
        });
      }
    } else {
      console.log(`✗ Transaction NOT FOUND on devnet`);
    }
  } catch (err) {
    console.log(`✗ Error checking transaction:`, err);
  }
}

async function main() {
  // Check the transaction signatures from the user's log
  await checkTx("48kbZHB8WteSf5bArCVQXYy8hobXj6Ufw2223tmA7aV9TJtDmjQryBQe2t3sfwpVEPLekvDqrcPKQdMnwvrEURSW");
  await checkTx("2tdU6x7EYkq9ZGXmCe6vK9D5NnGpbp5Qgc4G4HeHrBwUQy2sDaexay8nJNsBczTTv6x2TPeUJEs2Yg7149L6Ho73");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
