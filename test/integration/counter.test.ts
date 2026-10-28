import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { counterAbi } from "@/lib/botchain/abi";
import { encodeCode, decodeCode, OrderStatus, findOrderIdFromReceipt } from "@/lib/counter";

const PORT = 8624;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const localChain = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ACCOUNTS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Alice (Shopkeeper)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Bob (Customer 1)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Charlie (Customer 2)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Dave (Customer 3)
  "0x47e179ec340f649b836459260f82e1ad918eef894f1177389214ff586a72b84e", // Eve (Outsider)
].map((k) => privateKeyToAccount(k as `0x${string}`));

describe("Counter On-Chain Integration Tests", () => {
  let anvil: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC),
  });

  const [alice, bob, charlie, dave, eve] = ACCOUNTS.map((account) =>
    createWalletClient({
      account,
      chain: localChain,
      transport: http(RPC),
    })
  );

  async function advanceTime(seconds: number) {
    await publicClient.request({
      method: "anvil_increaseTime" as any,
      params: [seconds] as any,
    });
    await publicClient.request({
      method: "anvil_mine" as any,
      params: [1] as any,
    });
  }

  beforeAll(async () => {
    anvil = spawn("anvil", [
      "--port",
      String(PORT),
      "--chain-id",
      String(CHAIN_ID),
      "--silent",
    ]);

    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        await publicClient.getBlockNumber();
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!ready) throw new Error(`Anvil failed to start on port ${PORT}`);

    // Deploy contract
    const artifactPath = join(
      process.cwd(),
      "contracts",
      "out",
      "Counter.sol",
      "Counter.json"
    );
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const bytecode = artifact.bytecode.object as `0x${string}`;

    const hash = await alice.deployContract({
      abi: counterAbi,
      bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error("Contract deploy failed: no address");
    contractAddress = receipt.contractAddress;
  });

  afterAll(() => {
    if (anvil) {
      anvil.kill("SIGKILL");
    }
  });

  it("opens a shop and populates shelf items", async () => {
    const hash = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "openShop",
      args: ["Green Grocer", 3600], // 1 hour refund window
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const shopCount = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "shopCount",
    });
    expect(shopCount).toBe(1n);

    const shop = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "shopOf",
      args: [1n],
    });
    expect(shop.name).toBe("Green Grocer");
    expect(shop.owner.toLowerCase()).toBe(alice.account.address.toLowerCase());
    expect(shop.refundAfter).toBe(3600);

    // Set items: COFFEE and TEA
    const h1 = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "setItem",
      args: [1n, encodeCode("COFFEE"), "Filter Coffee", parseEther("0.05")],
    });
    await publicClient.waitForTransactionReceipt({ hash: h1 });

    const h2 = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "setItem",
      args: [1n, encodeCode("TEA"), "Earl Grey Tea", parseEther("0.02")],
    });
    await publicClient.waitForTransactionReceipt({ hash: h2 });

    const items = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "itemsOf",
      args: [1n],
    });
    expect(items).toHaveLength(2);
    expect(decodeCode(items[0].code)).toBe("COFFEE");
    expect(items[0].label).toBe("Filter Coffee");
    expect(items[0].price).toBe(parseEther("0.05"));
    expect(items[0].active).toBe(true);

    expect(decodeCode(items[1].code)).toBe("TEA");
    expect(items[1].label).toBe("Earl Grey Tea");
    expect(items[1].price).toBe(parseEther("0.02"));
  });

  it("places an order and verifies receipt extraction and state", async () => {
    // Bob orders 2 coffees at 0.05 BOT = 0.10 BOT
    const hash = await bob.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "order",
      args: [1n, encodeCode("COFFEE"), 2],
      value: parseEther("0.10"),
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const orderId = findOrderIdFromReceipt(receipt, contractAddress);
    expect(orderId).toBe(1n);

    const order = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "orderOf",
      args: [1n],
    });
    expect(order.shopId).toBe(1n);
    expect(order.customer.toLowerCase()).toBe(bob.account.address.toLowerCase());
    expect(order.amount).toBe(parseEther("0.10"));
    expect(order.qty).toBe(2);
    expect(order.status).toBe(OrderStatus.Placed);
    expect(decodeCode(order.item)).toBe("COFFEE");
  });

  it("guarantees orders keep their price after a price change (acceptance checklist §8.2)", async () => {
    // Alice raises COFFEE price to 0.08 BOT
    const hPrice = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "setItem",
      args: [1n, encodeCode("COFFEE"), "Filter Coffee", parseEther("0.08")],
    });
    await publicClient.waitForTransactionReceipt({ hash: hPrice });

    // Charlie places order #2 for 2 coffees at new price: 2 * 0.08 = 0.16 BOT
    const hOrder = await charlie.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "order",
      args: [1n, encodeCode("COFFEE"), 2],
      value: parseEther("0.16"),
    });
    const receipt2 = await publicClient.waitForTransactionReceipt({ hash: hOrder });
    const order2Id = findOrderIdFromReceipt(receipt2, contractAddress);
    expect(order2Id).toBe(2n);

    // Verify Bob's order #1 STILL retains its original 0.10 BOT amount
    const order1 = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "orderOf",
      args: [1n],
    });
    expect(order1.amount).toBe(parseEther("0.10"));

    // Verify Charlie's order #2 has the new 0.16 BOT amount
    const order2 = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "orderOf",
      args: [2n],
    });
    expect(order2.amount).toBe(parseEther("0.16"));
  });

  it("fulfils an order, credits shopkeeper, and executes withdrawal", async () => {
    // Alice fulfils Bob's order #1 (0.10 BOT)
    const hFulfil = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "fulfil",
      args: [1n],
    });
    await publicClient.waitForTransactionReceipt({ hash: hFulfil });

    const order1 = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "orderOf",
      args: [1n],
    });
    expect(order1.status).toBe(OrderStatus.Fulfilled);

    const pendingAlice = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "pending",
      args: [alice.account.address],
    });
    expect(pendingAlice).toBe(parseEther("0.10"));

    // Alice withdraws
    const balBefore = await publicClient.getBalance({ address: alice.account.address });
    const hWithdraw = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "withdraw",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hWithdraw });
    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
    const balAfter = await publicClient.getBalance({ address: alice.account.address });

    expect(balAfter + gasUsed - balBefore).toBe(parseEther("0.10"));

    const pendingAfter = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "pending",
      args: [alice.account.address],
    });
    expect(pendingAfter).toBe(0n);
  });

  it("declines an order, refunding customer to pending balance immediately", async () => {
    // Alice declines Charlie's order #2 (0.16 BOT)
    const hDecline = await alice.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "decline",
      args: [2n],
    });
    await publicClient.waitForTransactionReceipt({ hash: hDecline });

    const order2 = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "orderOf",
      args: [2n],
    });
    expect(order2.status).toBe(OrderStatus.Declined);

    const pendingCharlie = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "pending",
      args: [charlie.account.address],
    });
    expect(pendingCharlie).toBe(parseEther("0.16"));

    // Charlie withdraws refund
    const balBefore = await publicClient.getBalance({ address: charlie.account.address });
    const hWithdraw = await charlie.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "withdraw",
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hWithdraw });
    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
    const balAfter = await publicClient.getBalance({ address: charlie.account.address });

    expect(balAfter + gasUsed - balBefore).toBe(parseEther("0.16"));
  });

  it("enforces auto-refund only after deadline and verifies exclusivity", async () => {
    // Dave places order #3 for 1 Tea (0.02 BOT)
    const hOrder = await dave.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "order",
      args: [1n, encodeCode("TEA"), 1],
      value: parseEther("0.02"),
    });
    await publicClient.waitForTransactionReceipt({ hash: hOrder });

    // Dave attempts early refund -> reverts TooEarly
    await expect(
      dave.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "refund",
        args: [3n],
      })
    ).rejects.toThrow();

    // Advance time past 1 hour (3601 seconds)
    await advanceTime(3601);

    // Stranger Eve attempts refund -> reverts NotCustomer
    await expect(
      eve.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "refund",
        args: [3n],
      })
    ).rejects.toThrow();

    // Dave claims refund
    const hRefund = await dave.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "refund",
      args: [3n],
    });
    await publicClient.waitForTransactionReceipt({ hash: hRefund });

    const order3 = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "orderOf",
      args: [3n],
    });
    expect(order3.status).toBe(OrderStatus.Refunded);

    // Exclusivity: Alice cannot fulfil order #3 now that it has been refunded
    await expect(
      alice.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "fulfil",
        args: [3n],
      })
    ).rejects.toThrow();

    // Dave withdraws
    const hWithdraw = await dave.writeContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "withdraw",
    });
    await publicClient.waitForTransactionReceipt({ hash: hWithdraw });
  });

  it("reverts on invalid actions: wrong payment, owner order, inactive item, empty withdraw", async () => {
    // Alice tries to order at her own shop
    await expect(
      alice.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "order",
        args: [1n, encodeCode("TEA"), 1],
        value: parseEther("0.02"),
      })
    ).rejects.toThrow();

    // Bob orders with wrong payment
    await expect(
      bob.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "order",
        args: [1n, encodeCode("TEA"), 1],
        value: parseEther("0.05"), // expects 0.02
      })
    ).rejects.toThrow();

    // Bob orders inactive item
    await expect(
      bob.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "order",
        args: [1n, encodeCode("NONEXISTENT"), 1],
        value: parseEther("0.01"),
      })
    ).rejects.toThrow();

    // Eve withdraws with 0 balance
    await expect(
      eve.writeContract({
        address: contractAddress,
        abi: counterAbi,
        functionName: "withdraw",
      })
    ).rejects.toThrow();
  });

  it("paginates shops and orders correctly", async () => {
    const [shops, ids] = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "latestShops",
      args: [0n, 10n],
    });
    expect(shops).toHaveLength(1);
    expect(ids[0]).toBe(1n);

    const [shopOrders, sOrderIds] = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "ordersByShop",
      args: [1n, 0n, 10n],
    });
    expect(shopOrders).toHaveLength(3);
    // Newest first: order 3, order 2, order 1
    expect(sOrderIds[0]).toBe(3n);
    expect(sOrderIds[1]).toBe(2n);
    expect(sOrderIds[2]).toBe(1n);

    const [bobOrders, bOrderIds] = await publicClient.readContract({
      address: contractAddress,
      abi: counterAbi,
      functionName: "ordersByCustomer",
      args: [bob.account.address, 0n, 10n],
    });
    expect(bobOrders).toHaveLength(1);
    expect(bOrderIds[0]).toBe(1n);
  });
});
