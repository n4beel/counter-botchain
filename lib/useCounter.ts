"use client";

import { useState, useCallback } from "react";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";
import {
  usePublicClient,
  useWalletClient,
  useAccount,
} from "wagmi";
import { counterAbi } from "./botchain/abi";
import { getDeployment, isDeployed } from "./botchain/deployment";
import { activeBotChain } from "./botchain/chain";
import { describeError } from "./errors";
import { useToast } from "@/components/ui/Toast";
import {
  findOrderIdFromReceipt,
  type ShopData,
  type ItemData,
  type OrderData,
  OrderStatus,
} from "./counter";

export function useCounter() {
  const deployment = getDeployment(activeBotChain.id);
  const deployed = isDeployed(activeBotChain.id);

  const publicClient = usePublicClient({ chainId: activeBotChain.id }); // stable-hook-result
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { toast } = useToast();

  const [isTransacting, setIsTransacting] = useState(false);

  // Fetch block timestamp for accurate countdown against simulated chain time
  const fetchBlockTimestamp = useCallback(async (): Promise<number> => {
    if (!publicClient) return Math.floor(Date.now() / 1000);
    try {
      const block = await publicClient.getBlock();
      return Number(block.timestamp);
    } catch {
      return Math.floor(Date.now() / 1000);
    }
  }, [publicClient]);

  // Read latest shops for directory
  const fetchLatestShops = useCallback(
    async (offset = 0n, count = 50n): Promise<ShopData[]> => {
      if (!publicClient || !deployed) return [];
      try {
        const [shops, ids] = await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "latestShops",
          args: [offset, count],
        });

        return shops.map((s, idx) => ({
          id: ids[idx],
          owner: s.owner,
          refundAfter: s.refundAfter,
          itemCount: s.itemCount,
          name: s.name,
        }));
      } catch (err) {
        console.error("fetchLatestShops error:", err);
        return [];
      }
    },
    [publicClient, deployed, deployment.address]
  );

  // Read a single shop
  const fetchShop = useCallback(
    async (id: bigint): Promise<ShopData | null> => {
      if (!publicClient || !deployed || id <= 0n) return null;
      try {
        const s = await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "shopOf",
          args: [id],
        });
        return {
          id,
          owner: s.owner,
          refundAfter: s.refundAfter,
          itemCount: s.itemCount,
          name: s.name,
        };
      } catch (err) {
        console.error("fetchShop error:", err);
        return null;
      }
    },
    [publicClient, deployed, deployment.address]
  );

  // Read items of a shop
  const fetchShopItems = useCallback(
    async (id: bigint): Promise<ItemData[]> => {
      if (!publicClient || !deployed || id <= 0n) return [];
      try {
        const items = await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "itemsOf",
          args: [id],
        });
        return items.map((it) => ({
          code: it.code,
          label: it.label,
          price: it.price,
          active: it.active,
        }));
      } catch (err) {
        console.error("fetchShopItems error:", err);
        return [];
      }
    },
    [publicClient, deployed, deployment.address]
  );

  // Read a single order
  const fetchOrder = useCallback(
    async (orderId: bigint): Promise<OrderData | null> => {
      if (!publicClient || !deployed || orderId <= 0n) return null;
      try {
        const o = await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "orderOf",
          args: [orderId],
        });
        return {
          id: orderId,
          shopId: o.shopId,
          customer: o.customer,
          amount: o.amount,
          placedAt: o.placedAt,
          item: o.item,
          qty: o.qty,
          status: o.status as OrderStatus,
        };
      } catch (err) {
        console.error("fetchOrder error:", err);
        return null;
      }
    },
    [publicClient, deployed, deployment.address]
  );

  // Read orders for a shop
  const fetchShopOrders = useCallback(
    async (shopId: bigint, offset = 0n, count = 50n): Promise<OrderData[]> => {
      if (!publicClient || !deployed || shopId <= 0n) return [];
      try {
        const [orders, ids] = await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "ordersByShop",
          args: [shopId, offset, count],
        });
        return orders.map((o, idx) => ({
          id: ids[idx],
          shopId: o.shopId,
          customer: o.customer,
          amount: o.amount,
          placedAt: o.placedAt,
          item: o.item,
          qty: o.qty,
          status: o.status as OrderStatus,
        }));
      } catch (err) {
        console.error("fetchShopOrders error:", err);
        return [];
      }
    },
    [publicClient, deployed, deployment.address]
  );

  // Read orders for a customer
  const fetchCustomerOrders = useCallback(
    async (
      customerAddr?: `0x${string}`,
      offset = 0n,
      count = 50n
    ): Promise<OrderData[]> => {
      const target = customerAddr || address;
      if (!publicClient || !deployed || !target) return [];
      try {
        const [orders, ids] = await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "ordersByCustomer",
          args: [target, offset, count],
        });
        return orders.map((o, idx) => ({
          id: ids[idx],
          shopId: o.shopId,
          customer: o.customer,
          amount: o.amount,
          placedAt: o.placedAt,
          item: o.item,
          qty: o.qty,
          status: o.status as OrderStatus,
        }));
      } catch (err) {
        console.error("fetchCustomerOrders error:", err);
        return [];
      }
    },
    [publicClient, deployed, deployment.address, address]
  );

  // Read pending balance
  const fetchPendingBalance = useCallback(
    async (accountAddr?: `0x${string}`): Promise<bigint> => {
      const target = accountAddr || address;
      if (!publicClient || !deployed || !target) return 0n;
      try {
        return await publicClient.readContract({
          address: deployment.address,
          abi: counterAbi,
          functionName: "pending",
          args: [target],
        });
      } catch (err) {
        console.error("fetchPendingBalance error:", err);
        return 0n;
      }
    },
    [publicClient, deployed, deployment.address, address]
  );

  // --- Transactions ---

  // Open shop
  const openShop = async (
    name: string,
    refundAfter: number
  ): Promise<bigint | null> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return null;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "openShop",
        args: [name, refundAfter],
      });
      toast("info", "Opening shop on-chain...");
      const receipt = await waitSuccess(publicClient, hash);
      toast("success", "Shop opened successfully!");

      const shopCount = await publicClient.readContract({
        address: deployment.address,
        abi: counterAbi,
        functionName: "shopCount",
      });
      return shopCount;
    } catch (err) {
      toast("error", describeError(err));
      return null;
    } finally {
      setIsTransacting(false);
    }
  };

  // Set item
  const setItem = async (
    shopId: bigint,
    code: `0x${string}`,
    label: string,
    price: bigint
  ): Promise<boolean> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return false;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "setItem",
        args: [shopId, code, label, price],
      });
      toast("info", "Updating shelf inventory...");
      await waitSuccess(publicClient, hash);
      toast("success", "Item updated on shelf!");
      return true;
    } catch (err) {
      toast("error", describeError(err));
      return false;
    } finally {
      setIsTransacting(false);
    }
  };

  // Place order
  const placeOrder = async (
    shopId: bigint,
    itemCode: `0x${string}`,
    qty: number,
    value: bigint
  ): Promise<bigint | null> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return null;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "order",
        args: [shopId, itemCode, qty],
        value,
      });
      toast("info", "Placing order and paying BOT...");
      const receipt = await waitSuccess(publicClient, hash);
      toast("success", "Order placed successfully!");
      const orderId = findOrderIdFromReceipt(receipt, deployment.address);
      return orderId;
    } catch (err) {
      toast("error", describeError(err));
      return null;
    } finally {
      setIsTransacting(false);
    }
  };

  // Fulfil order
  const fulfilOrder = async (orderId: bigint): Promise<boolean> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return false;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "fulfil",
        args: [orderId],
      });
      toast("info", "Marking order fulfilled...");
      await waitSuccess(publicClient, hash);
      toast("success", "Order fulfilled! Payment credited to your pending balance.");
      return true;
    } catch (err) {
      toast("error", describeError(err));
      return false;
    } finally {
      setIsTransacting(false);
    }
  };

  // Decline order
  const declineOrder = async (orderId: bigint): Promise<boolean> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return false;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "decline",
        args: [orderId],
      });
      toast("info", "Declining order...");
      await waitSuccess(publicClient, hash);
      toast("success", "Order declined. Customer refunded to pending balance.");
      return true;
    } catch (err) {
      toast("error", describeError(err));
      return false;
    } finally {
      setIsTransacting(false);
    }
  };

  // Refund order
  const refundOrder = async (orderId: bigint): Promise<boolean> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return false;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "refund",
        args: [orderId],
      });
      toast("info", "Claiming order refund...");
      await waitSuccess(publicClient, hash);
      toast("success", "Refund claimed! Amount credited to your pending balance.");
      return true;
    } catch (err) {
      toast("error", describeError(err));
      return false;
    } finally {
      setIsTransacting(false);
    }
  };

  // Withdraw
  const withdrawBalance = async (): Promise<boolean> => {
    if (!walletClient || !publicClient || !deployed) {
      toast("error", "Wallet not connected or contract not deployed.");
      return false;
    }
    setIsTransacting(true);
    try {
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: counterAbi,
        functionName: "withdraw",
      });
      toast("info", "Withdrawing balance...");
      await waitSuccess(publicClient, hash);
      toast("success", "Withdrawn successfully to your wallet!");
      return true;
    } catch (err) {
      toast("error", describeError(err));
      return false;
    } finally {
      setIsTransacting(false);
    }
  };

  return {
    deployed,
    deployment,
    isTransacting,
    fetchBlockTimestamp,
    fetchLatestShops,
    fetchShop,
    fetchShopItems,
    fetchOrder,
    fetchShopOrders,
    fetchCustomerOrders,
    fetchPendingBalance,
    openShop,
    setItem,
    placeOrder,
    fulfilOrder,
    declineOrder,
    refundOrder,
    withdrawBalance,
  };
}
