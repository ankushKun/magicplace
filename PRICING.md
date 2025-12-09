# MagicPlace Shard Pricing Guide

This document outlines the storage costs for different canvas resolution and shard dimension combinations.

**Assumptions:**
- 4-bit color packing (2 pixels per byte, 16 colors including transparent)
- SOL price: ~$230 USD (update as needed)
- Rent costs from Solana devnet

---

## Shard Size Reference

| Shard Dimension | Pixels/Shard | Bytes (4-bit) | Rent Cost (SOL) | Rent Cost (USD) |
|-----------------|--------------|---------------|-----------------|-----------------|
| 1024×1024 | 1,048,576 | ~512 KB | 3.65 SOL | $840 |
| 512×512 | 262,144 | ~128 KB | 0.91 SOL | $210 |
| 256×256 | 65,536 | ~32 KB | 0.23 SOL | $53 |
| 128×128 | 16,384 | ~8 KB | 0.058 SOL | $13 |

---

## Canvas Resolution: 2^20 (1,048,576 × 1,048,576 pixels)

**Total Canvas Area:** 1.1 trillion pixels

| Shard Dim | Shards/Dim | Total Shards | Rent/Shard | Full Canvas Cost (SOL) | Full Canvas Cost (USD) |
|-----------|------------|--------------|------------|------------------------|------------------------|
| 1024×1024 | 1,024 | 1,048,576 | 3.65 SOL | 3,827,302 SOL | $880M |
| 512×512 | 2,048 | 4,194,304 | 0.91 SOL | 3,816,817 SOL | $878M |
| 256×256 | 4,096 | 16,777,216 | 0.23 SOL | 3,858,760 SOL | $888M |
| 128×128 | 8,192 | 67,108,864 | 0.058 SOL | 3,892,314 SOL | $895M |

---

## Canvas Resolution: 2^19 (524,288 × 524,288 pixels)

**Total Canvas Area:** 275 billion pixels

| Shard Dim | Shards/Dim | Total Shards | Rent/Shard | Full Canvas Cost (SOL) | Full Canvas Cost (USD) |
|-----------|------------|--------------|------------|------------------------|------------------------|
| 1024×1024 | 512 | 262,144 | 3.65 SOL | 956,826 SOL | $220M |
| 512×512 | 1,024 | 1,048,576 | 0.91 SOL | 954,204 SOL | $219M |
| 256×256 | 2,048 | 4,194,304 | 0.23 SOL | 964,690 SOL | $222M |
| 128×128 | 4,096 | 16,777,216 | 0.058 SOL | 973,079 SOL | $224M |

---

## Canvas Resolution: 2^18 (262,144 × 262,144 pixels) ⭐ Current

**Total Canvas Area:** 68.7 billion pixels

| Shard Dim | Shards/Dim | Total Shards | Rent/Shard | Full Canvas Cost (SOL) | Full Canvas Cost (USD) |
|-----------|------------|--------------|------------|------------------------|------------------------|
| 1024×1024 | 256 | 65,536 | 3.65 SOL | 239,206 SOL | $55M |
| 512×512 | 512 | 262,144 | 0.91 SOL | 238,551 SOL | $55M |
| 256×256 | 1,024 | 1,048,576 | 0.23 SOL | 241,173 SOL | $55M |
| **128×128** | **2,048** | **4,194,304** | **0.058 SOL** | **243,270 SOL** | **$56M** |

---

## Key Insights

### Per-Shard Cost (What Users Pay)

| Shard Dimension | Cost (SOL) | Cost (USD) | Best For |
|-----------------|------------|------------|----------|
| 1024×1024 | 3.65 | $840 | Dense, high-activity areas |
| 512×512 | 0.91 | $210 | Medium activity |
| 256×256 | 0.23 | $53 | Casual usage |
| **128×128** | **0.058** | **$13** | **Low barrier to entry** ⭐ |

### Trade-offs Summary

| Factor | Larger Shards (1024) | Smaller Shards (128) |
|--------|---------------------|----------------------|
| Cost per shard | Higher ($840) | Lower ($13) |
| Total shards | Fewer (65K) | More (4.2M) |
| Account overhead | Lower | Higher |
| User barrier | Higher | Lower |
| Query complexity | Simpler | More PDAs |
| Sparse adoption | Wasteful | Efficient |

### Recommendations

1. **For low barrier to entry:** Use 128×128 shards (~$13 each)
2. **For dense canvas usage:** Use 512×512 or 1024×1024 shards
3. **For balanced approach:** Use 256×256 shards (~$53 each)

---

## Technical Notes

- **Shard coordinates:** Stored as `u16` (supports up to 65,535 shards per dimension)
- **Color depth:** 4-bit (16 colors including transparent)
- **PDA seeds:** `["shard", shard_x.to_le_bytes(), shard_y.to_le_bytes()]`
- **Account size formula:** `8 (discriminator) + 2 (shard_x) + 2 (shard_y) + 4 (vec_len) + (shard_dim² / 2) + 1 (bump)`

---

*Last updated: December 2024*
