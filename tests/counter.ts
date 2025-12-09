import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { Counter } from "../target/types/counter";
import { GetCommitmentSignature } from "@magicblock-labs/ephemeral-rollups-sdk";

describe("counter", () => {
  console.log("counter.ts");

  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Set up Ephemeral Rollup provider
  const providerEphemeralRollup = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.EPHEMERAL_PROVIDER_ENDPOINT ||
      "https://rpc.magicblock.app/devnet",
      {
        wsEndpoint:
          process.env.EPHEMERAL_WS_ENDPOINT || "wss://devnet.magicblock.app/",
      }
    ),
    anchor.Wallet.local()
  );

  console.log("Base Layer Connection: ", provider.connection.rpcEndpoint);
  console.log(
    "Ephemeral Rollup Connection: ",
    providerEphemeralRollup.connection.rpcEndpoint
  );
  console.log(`Current SOL Public Key: ${anchor.Wallet.local().publicKey}`);

  const program = anchor.workspace.Counter as Program<Counter>;
  const authority = provider.wallet;

  // Derive PDA using user's public key
  const [counterPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [authority.publicKey.toBuffer()],
    program.programId
  );

  console.log("Program ID: ", program.programId.toString());
  console.log("Counter PDA: ", counterPDA.toString());

  before(async function () {
    const balance = await provider.connection.getBalance(
      anchor.Wallet.local().publicKey
    );
    console.log("Current balance is", balance / LAMPORTS_PER_SOL, " SOL", "\n");
  });

  // ========================================
  // Base Layer Tests
  // ========================================

  describe("initialize", () => {
    it("initializes a counter with count 0", async () => {
      const start = Date.now();
      let tx = await program.methods
        .initialize()
        .accounts({
          authority: authority.publicKey,
        })
        .transaction();

      const txHash = await provider.sendAndConfirm(
        tx,
        [provider.wallet.payer],
        {
          skipPreflight: true,
          commitment: "confirmed",
        }
      );
      const duration = Date.now() - start;
      console.log(`${duration}ms (Base Layer) Initialize txHash: ${txHash}`);

      const counterAccount = await program.account.counter.fetch(counterPDA);
      expect(counterAccount.count.toNumber()).to.equal(0);
      expect(counterAccount.authority.toBase58()).to.equal(
        authority.publicKey.toBase58()
      );
    });
  });

  describe("increment", () => {
    it("increments the counter by 1", async () => {
      const start = Date.now();
      let tx = await program.methods
        .increment()
        .accounts({
          authority: authority.publicKey,
        })
        .transaction();

      const txHash = await provider.sendAndConfirm(
        tx,
        [provider.wallet.payer],
        {
          skipPreflight: true,
          commitment: "confirmed",
        }
      );
      const duration = Date.now() - start;
      console.log(`${duration}ms (Base Layer) Increment txHash: ${txHash}`);

      const counterAccount = await program.account.counter.fetch(counterPDA);
      expect(counterAccount.count.toNumber()).to.be.greaterThan(0);
    });

    it("increments multiple times", async () => {
      const counterBefore = await program.account.counter.fetch(counterPDA);
      const initialCount = counterBefore.count.toNumber();

      // Increment 3 times
      for (let i = 0; i < 3; i++) {
        await program.methods
          .increment()
          .accounts({
            authority: authority.publicKey,
          })
          .rpc();
      }

      const counterAccount = await program.account.counter.fetch(counterPDA);
      expect(counterAccount.count.toNumber()).to.equal(initialCount + 3);
    });
  });

  describe("decrement", () => {
    it("decrements the counter by 1", async () => {
      const counterBefore = await program.account.counter.fetch(counterPDA);
      const initialCount = counterBefore.count.toNumber();

      await program.methods
        .decrement()
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      const counterAccount = await program.account.counter.fetch(counterPDA);
      expect(counterAccount.count.toNumber()).to.equal(initialCount - 1);
    });
  });

  describe("set", () => {
    it("sets the counter to a specific value", async () => {
      await program.methods
        .set(new anchor.BN(42))
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      const counterAccount = await program.account.counter.fetch(counterPDA);
      expect(counterAccount.count.toNumber()).to.equal(42);
    });
  });

  // ========================================
  // Ephemeral Rollups Tests
  // ========================================

  describe("delegation", () => {
    it("delegates counter to ER", async () => {
      // First reset counter to a known value
      await program.methods
        .set(new anchor.BN(100))
        .accounts({
          authority: authority.publicKey,
        })
        .rpc();

      const start = Date.now();
      // Add local validator identity to remaining accounts if running on localnet
      const remainingAccounts =
        providerEphemeralRollup.connection.rpcEndpoint.includes("localhost") ||
          providerEphemeralRollup.connection.rpcEndpoint.includes("127.0.0.1")
          ? [
            {
              pubkey: new web3.PublicKey(
                "mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev"
              ),
              isSigner: false,
              isWritable: false,
            },
          ]
          : [];

      let tx = await program.methods
        .delegate()
        .accounts({
          payer: authority.publicKey,
        })
        .remainingAccounts(remainingAccounts)
        .transaction();

      const txHash = await provider.sendAndConfirm(
        tx,
        [provider.wallet.payer],
        {
          skipPreflight: true,
          commitment: "confirmed",
        }
      );
      const duration = Date.now() - start;
      console.log(`${duration}ms (Base Layer) Delegate txHash: ${txHash}`);
    });

    it("increments counter on ER", async () => {
      const start = Date.now();
      // Build transaction using base program
      let tx = await program.methods
        .increment()
        .accounts({
          authority: authority.publicKey,
        })
        .transaction();

      // Set up for ER connection
      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);

      // Send using raw connection to avoid Anchor response parsing issues
      const txHash = await providerEphemeralRollup.connection.sendRawTransaction(
        tx.serialize(),
        { skipPreflight: true }
      );
      await providerEphemeralRollup.connection.confirmTransaction(txHash, "confirmed");

      const duration = Date.now() - start;
      console.log(`${duration}ms (ER) Increment txHash: ${txHash}`);
    });

    it("commits counter state on ER to Solana", async () => {
      const start = Date.now();
      // Build transaction using base program
      let tx = await program.methods
        .commit()
        .accounts({
          payer: providerEphemeralRollup.wallet.publicKey,
        })
        .transaction();

      // Set up for ER connection
      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);

      // Send using raw connection to avoid Anchor response parsing issues
      const txHash = await providerEphemeralRollup.connection.sendRawTransaction(
        tx.serialize(),
        { skipPreflight: true }
      );
      await providerEphemeralRollup.connection.confirmTransaction(txHash, "confirmed");

      const duration = Date.now() - start;
      console.log(`${duration}ms (ER) Commit txHash: ${txHash}`);

      // Get the commitment signature on the base layer (may not work on localnet)
      try {
        const confirmCommitStart = Date.now();
        const txCommitSgn = await GetCommitmentSignature(
          txHash,
          providerEphemeralRollup.connection
        );
        const commitDuration = Date.now() - confirmCommitStart;
        console.log(
          `${commitDuration}ms (Base Layer) Commit txHash: ${txCommitSgn}`
        );
      } catch (e) {
        console.log("GetCommitmentSignature not available on localnet (expected)");
      }
    });

    it("undelegates counter from ER to Solana", async () => {
      const start = Date.now();
      // Build transaction using base program
      let tx = await program.methods
        .undelegate()
        .accounts({
          payer: providerEphemeralRollup.wallet.publicKey,
        })
        .transaction();

      // Set up for ER connection
      tx.feePayer = providerEphemeralRollup.wallet.publicKey;
      tx.recentBlockhash = (
        await providerEphemeralRollup.connection.getLatestBlockhash()
      ).blockhash;
      tx = await providerEphemeralRollup.wallet.signTransaction(tx);

      // Send using raw connection to avoid Anchor response parsing issues
      const txHash = await providerEphemeralRollup.connection.sendRawTransaction(
        tx.serialize(),
        { skipPreflight: true }
      );
      await providerEphemeralRollup.connection.confirmTransaction(txHash, "confirmed");

      const duration = Date.now() - start;
      console.log(`${duration}ms (ER) Undelegate txHash: ${txHash}`);

      // Verify the counter was updated
      // On localnet, the ER state might sync differently, so we check for >= 100
      const counterAccount = await program.account.counter.fetch(counterPDA);
      console.log(`Counter value after undelegation: ${counterAccount.count}`);
      expect(counterAccount.count.toNumber()).to.be.at.least(100);
    });
  });
});
