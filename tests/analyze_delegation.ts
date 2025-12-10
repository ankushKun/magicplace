import * as anchor from "@coral-xyz/anchor";

const devnetConnection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
const erConnection = new anchor.web3.Connection("https://devnet.magicblock.app", "confirmed");

async function checkShardState() {
    const PROGRAM_ID = new anchor.web3.PublicKey("CHhht9A6W95JYGm3AA1yH34n112uexmrpKqoSwKwfmxE");
    const DELEGATION_PROGRAM_ID = new anchor.web3.PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
    const SHARD_SEED = Buffer.from("shard");

    const shardX = 649;
    const shardY = 1579;

    const shardXBytes = Buffer.alloc(2);
    shardXBytes.writeUInt16LE(shardX);
    const shardYBytes = Buffer.alloc(2);
    shardYBytes.writeUInt16LE(shardY);

    const [shardPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [SHARD_SEED, shardXBytes, shardYBytes],
        PROGRAM_ID
    );

    console.log(`\nChecking Shard State (${shardX}, ${shardY})`);
    console.log(`PDA: ${shardPDA.toBase58()}`);

    // Check Base Layer
    console.log("\n--- Base Layer (Devnet) ---");
    const baseInfo = await devnetConnection.getAccountInfo(shardPDA);
    if (!baseInfo) {
        console.log("Account NOT FOUND on base layer");
    } else {
        console.log("Owner:", baseInfo.owner.toBase58());
        if (baseInfo.owner.equals(DELEGATION_PROGRAM_ID)) {
            console.log("Status: DELEGATED (Correct Owner)");
        } else if (baseInfo.owner.equals(PROGRAM_ID)) {
            console.log("Status: UNDELEGATED (Magicplace Program Owner)");
        } else {
            console.log("Status: UNKNOWN OWNER");
        }
    }

    // Check ER Layer
    console.log("\n--- Ephemeral Rollup Layer ---");
    try {
        const erInfo = await erConnection.getAccountInfo(shardPDA);
        if (!erInfo) {
            console.log("Account NOT FOUND on ER");
        } else {
             console.log("Account FOUND on ER");
             console.log("Owner:", erInfo.owner.toBase58());
             console.log("Data Length:", erInfo.data.length);
        }
    } catch (e) {
        console.log("Error checking ER:", e);
    }
}

// checkTx().then(() => checkShardState()).then(() => process.exit(0)).catch(console.error);
checkShardState().then(() => process.exit(0)).catch(console.error);
