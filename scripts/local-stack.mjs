/**
 * Local stack runner and seeder for Counter (Archetype AC · Shopfront).
 *
 * Spawns anvil on port 8724 with chain id 968, deploys Counter, and seeds state:
 * - Shop 1 (The Corner Tin): 6 items on shelf (Sardines, Tomatoes, Peaches, Tea, Biscuits, Coffee)
 *   - Order 1: Placed before price change (Bob, 2 coffees @ 0.06 = 0.12 BOT; shelf price raised to 0.09 BOT)
 *   - Order 2: Fulfilled (Charlie, 1 Sardines @ 0.05 BOT)
 *   - Order 3: Declined (Dave, 3 Peaches @ 0.04 = 0.12 BOT)
 *   - Order 4: Refunded (Bob, 1 Tomatoes @ 0.03 BOT, past deadline and refunded)
 *   - Order 5: Placed and past deadline (Charlie, 2 Tea @ 0.02 = 0.04 BOT, refundable now)
 *   - Order 6: Placed fresh (Dave, 2 Biscuits @ 0.025 = 0.05 BOT, countdown active)
 * - Shop 2 (Market Empty Hall): Empty shelf (0 items)
 *
 * Usage:
 *   node scripts/local-stack.mjs
 *   npm run dev
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8724;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: Alice (Shopkeeper)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: Bob (Customer A)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: Charlie (Customer B)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: Dave (Customer C)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4: Eve (Outsider / Second Shopkeeper)
];

const accounts = KEYS.map((k) => privateKeyToAccount(k));

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

console.log(`Starting anvil on port ${PORT}...`);
spawn(
  "anvil",
  [
    "--port",
    String(PORT),
    "--chain-id",
    String(CHAIN_ID),
    "--accounts",
    "10",
    "--balance",
    "1000",
    "--silent",
  ],
  { detached: true, stdio: "ignore" }
).unref();

const pub = createPublicClient({ chain: local, transport: http() });

for (let i = 0; i < 40; i++) {
  try {
    await pub.getBlockNumber();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}

const artifact = JSON.parse(
  readFileSync(
    new URL("../contracts/out/Counter.sol/Counter.json", import.meta.url),
    "utf8"
  )
);

const wallets = accounts.map((account) =>
  createWalletClient({ account, chain: local, transport: http() })
);

console.log("Deploying Counter contract...");
const deployHash = await wallets[0].deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
});

const deployReceipt = await pub.waitForTransactionReceipt({ hash: deployHash });
const contractAddress = deployReceipt.contractAddress;
const startBlock = deployReceipt.blockNumber;

console.log(`Deployed Counter to ${contractAddress} at block ${startBlock}`);

async function advanceTime(seconds) {
  await pub.request({ method: "evm_increaseTime", params: [seconds] });
  await pub.request({ method: "evm_mine", params: [] });
}

function encodeCode(str) {
  return stringToHex(str.slice(0, 16), { size: 16 });
}

console.log("Seeding shops and inventory...");

// 1. Open Shop 1: "The Corner Tin" (1 hour refund window)
console.log("Creating Shop 1: The Corner Tin...");
const s1Tx = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "openShop",
  args: ["The Corner Tin", 3600],
});
await pub.waitForTransactionReceipt({ hash: s1Tx });

// 2. Populate 6 items on Shop 1 shelf
const items = [
  { code: "TIN_SARDINES", label: "Cornish Sardines", price: parseEther("0.05") },
  { code: "TIN_TOMATOES", label: "San Marzano Plum Tomatoes", price: parseEther("0.03") },
  { code: "TIN_PEACHES", label: "Cling Peaches in Syrup", price: parseEther("0.04") },
  { code: "TEA_LEAVES", label: "Highland Black Tea", price: parseEther("0.02") },
  { code: "BISCUITS", label: "Oatmeal Biscuits", price: parseEther("0.025") },
  { code: "ROAST_COFFEE", label: "Dark Roast Coffee", price: parseEther("0.06") },
];

for (const it of items) {
  const tx = await wallets[0].writeContract({
    address: contractAddress,
    abi: artifact.abi,
    functionName: "setItem",
    args: [1n, encodeCode(it.code), it.label, it.price],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
}

// 3. Open Shop 2: "Market Empty Hall" (Eve, 2 hours window, 0 items)
console.log("Creating Shop 2: Market Empty Hall (empty shelf)...");
const s2Tx = await wallets[4].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "openShop",
  args: ["Market Empty Hall", 7200],
});
await pub.waitForTransactionReceipt({ hash: s2Tx });

console.log("Seeding orders in Shop 1...");

// Order 1: Bob orders 2 coffees @ 0.06 = 0.12 BOT before price change
console.log("Order 1: Bob places order for 2 coffees @ 0.06 BOT...");
const o1Tx = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "order",
  args: [1n, encodeCode("ROAST_COFFEE"), 2],
  value: parseEther("0.12"),
});
await pub.waitForTransactionReceipt({ hash: o1Tx });

// Alice changes coffee price to 0.09 BOT!
console.log("Alice raises coffee price to 0.09 BOT (Order 1 preserves 0.12 BOT)...");
const pTx = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "setItem",
  args: [1n, encodeCode("ROAST_COFFEE"), "Dark Roast Coffee", parseEther("0.09")],
});
await pub.waitForTransactionReceipt({ hash: pTx });

// Order 2: Charlie orders 1 Sardines @ 0.05 BOT -> Fulfilled
console.log("Order 2: Charlie places order for 1 Sardines (0.05 BOT) -> Alice fulfils...");
const o2Tx = await wallets[2].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "order",
  args: [1n, encodeCode("TIN_SARDINES"), 1],
  value: parseEther("0.05"),
});
await pub.waitForTransactionReceipt({ hash: o2Tx });

const fTx = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "fulfil",
  args: [2n],
});
await pub.waitForTransactionReceipt({ hash: fTx });

// Order 3: Dave orders 3 Peaches @ 0.04 = 0.12 BOT -> Declined
console.log("Order 3: Dave places order for 3 Peaches (0.12 BOT) -> Alice declines...");
const o3Tx = await wallets[3].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "order",
  args: [1n, encodeCode("TIN_PEACHES"), 3],
  value: parseEther("0.12"),
});
await pub.waitForTransactionReceipt({ hash: o3Tx });

const dTx = await wallets[0].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "decline",
  args: [3n],
});
await pub.waitForTransactionReceipt({ hash: dTx });

// Order 4: Bob orders 1 Tomatoes @ 0.03 BOT -> Advance time -> Bob refunds
console.log("Order 4: Bob places order for 1 Tomatoes (0.03 BOT) -> past deadline -> refunded...");
const o4Tx = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "order",
  args: [1n, encodeCode("TIN_TOMATOES"), 1],
  value: parseEther("0.03"),
});
await pub.waitForTransactionReceipt({ hash: o4Tx });

await advanceTime(3605);

const rTx = await wallets[1].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "refund",
  args: [4n],
});
await pub.waitForTransactionReceipt({ hash: rTx });

// Order 5: Charlie orders 2 Tea @ 0.02 = 0.04 BOT -> Advance time -> past deadline & refundable
console.log("Order 5: Charlie places order for 2 Tea (0.04 BOT) -> past deadline & ready for refund...");
const o5Tx = await wallets[2].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "order",
  args: [1n, encodeCode("TEA_LEAVES"), 2],
  value: parseEther("0.04"),
});
await pub.waitForTransactionReceipt({ hash: o5Tx });

await advanceTime(3605);

// Order 6: Dave orders 2 Biscuits @ 0.025 = 0.05 BOT (freshly placed, countdown active)
console.log("Order 6: Dave places fresh order for 2 Biscuits (0.05 BOT, fresh)...");
const o6Tx = await wallets[3].writeContract({
  address: contractAddress,
  abi: artifact.abi,
  functionName: "order",
  args: [1n, encodeCode("BISCUITS"), 2],
  value: parseEther("0.05"),
});
await pub.waitForTransactionReceipt({ hash: o6Tx });

console.log("\nRoles Table:");
console.log("------------------------------------------------------------------------------------------------");
console.log("| Role                 | Index | Address                                    | Private Key (first 10) |");
console.log("------------------------------------------------------------------------------------------------");
console.log(`| Shopkeeper (Alice)   | 0     | ${accounts[0].address} | ${KEYS[0].slice(0, 10)}... |`);
console.log(`| Customer A (Bob)     | 1     | ${accounts[1].address} | ${KEYS[1].slice(0, 10)}... |`);
console.log(`| Customer B (Charlie) | 2     | ${accounts[2].address} | ${KEYS[2].slice(0, 10)}... |`);
console.log(`| Customer C (Dave)    | 3     | ${accounts[3].address} | ${KEYS[3].slice(0, 10)}... |`);
console.log(`| Outsider (Eve)       | 4     | ${accounts[4].address} | ${KEYS[4].slice(0, 10)}... |`);
console.log("------------------------------------------------------------------------------------------------\n");

console.log("Seeded Status Table:");
console.log("------------------------------------------------------------------------------------------------");
console.log("| Order ID | Customer             | Items & Qty         | Amount    | State      | Action Available     |");
console.log("------------------------------------------------------------------------------------------------");
console.log("| #1       | Customer A (Bob)     | 2x Coffee (Pre-bump)| 0.12 BOT  | Placed     | Fulfil or Decline    |");
console.log("| #2       | Customer B (Charlie) | 1x Sardines         | 0.05 BOT  | Fulfilled  | Owner can withdraw   |");
console.log("| #3       | Customer C (Dave)    | 3x Peaches          | 0.12 BOT  | Declined   | Dave can withdraw    |");
console.log("| #4       | Customer A (Bob)     | 1x Tomatoes         | 0.03 BOT  | Refunded   | Bob can withdraw     |");
console.log("| #5       | Customer B (Charlie) | 2x Black Tea        | 0.04 BOT  | Placed     | Ready for Refund!    |");
console.log("| #6       | Customer C (Dave)    | 2x Biscuits         | 0.05 BOT  | Placed     | Fresh countdown      |");
console.log("------------------------------------------------------------------------------------------------\n");

// Write .env.local
const envContent = [
  `NEXT_PUBLIC_BOTCHAIN_NETWORK=testnet`,
  `NEXT_PUBLIC_BOHR_RPC=${RPC}`,
  `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
  `NEXT_PUBLIC_DEPLOY_BLOCK_968=${startBlock}`,
  "",
].join("\n");

writeFileSync(".env.local", envContent);
console.log("Wrote .env.local");
console.log(`\nLocal stack ready on port ${PORT}!`);
