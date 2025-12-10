import * as anchor from "@coral-xyz/anchor";

const devnetConnection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");

async function checkAccount(pubkeyStr: string, label: string) {
  const pubkey = new anchor.web3.PublicKey(pubkeyStr);
  console.log(`\n${label}: ${pubkeyStr}`);
  
  try {
    const info = await devnetConnection.getAccountInfo(pubkey);
    if (info) {
      console.log(`  ✓ EXISTS`);
      console.log(`  Owner: ${info.owner.toBase58()}`);
      console.log(`  Data length: ${info.data.length} bytes`);
      console.log(`  Lamports: ${info.lamports}`);
    } else {
      console.log(`  ✗ DOES NOT EXIST`);
    }
  } catch (err) {
    console.log(`  Error: ${err}`);
  }
}

async function main() {
  console.log("Checking delegation-related accounts...");
  
  await checkAccount("HfqPYrJMM9aHTXy2bx7bex7CQEYpGR3N1PhL33AkodPV", "buffer_pda");
  await checkAccount("CMzZK4CXBvisv7P3FjMa3XULuBcA2bDHHZxCg2aCnG4R", "delegation_record_pda (FAILING)");
  await checkAccount("8AHx93f11rTPQRuHi3aSSyiNui6jtVVjyMLKhjQ5jwXm", "delegation_metadata_pda");
  await checkAccount("FBndsWwaSUYZkrNyt3eh47ARgxVkFE1mQi4YQx6LkAK7", "shard_pda");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
