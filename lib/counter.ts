import { stringToHex, hexToString, type Log } from "viem";
import { parseOrderedLog } from "./logs";

export enum OrderStatus {
  Placed = 0,
  Fulfilled = 1,
  Declined = 2,
  Refunded = 3,
}

export interface ShopData {
  id: bigint;
  owner: `0x${string}`;
  refundAfter: number;
  itemCount: number;
  name: string;
}

export interface ItemData {
  price: bigint;
  active: boolean;
  code: `0x${string}`;
  label: string;
}

export interface OrderData {
  id: bigint;
  shopId: bigint;
  customer: `0x${string}`;
  amount: bigint;
  placedAt: bigint;
  item: `0x${string}`;
  qty: number;
  status: OrderStatus;
}

/**
 * Encodes a short string identifier into a 16-byte hex value (bytes16 in Solidity).
 * Right-padded with zero bytes.
 */
export function encodeCode(str: string): `0x${string}` {
  const trimmed = str.trim().slice(0, 16);
  return stringToHex(trimmed, { size: 16 });
}

/**
 * Decodes a 16-byte hex string (bytes16) back into a human-readable string,
 * stripping trailing null bytes.
 */
export function decodeCode(hex: string): string {
  if (!hex || hex === "0x" || hex === "0x0") return "";
  const cleanHex = hex.startsWith("0x") ? hex : `0x${hex}`;
  try {
    let h = cleanHex.slice(2);
    // Strip trailing pairs of 00
    while (h.endsWith("00") && h.length > 0) {
      h = h.slice(0, -2);
    }
    if (h.length === 0) return "";
    return hexToString(`0x${h}` as `0x${string}`);
  } catch {
    return cleanHex;
  }
}

/**
 * Calculates order total: price * qty.
 */
export function orderTotal(price: bigint, qty: number): bigint {
  const safeQty = Math.max(0, Math.floor(qty));
  return price * BigInt(safeQty);
}

/**
 * Computes the Unix timestamp (seconds) when an order becomes eligible for customer refund.
 */
export function refundReadyAt(
  placedAt: bigint | number,
  refundAfter: bigint | number
): number {
  return Number(placedAt) + Number(refundAfter);
}

/**
 * Checks whether an order is past its refund deadline.
 */
export function isRefundReady(
  placedAt: bigint | number,
  refundAfter: bigint | number,
  currentTimestampSec?: number
): boolean {
  const now = currentTimestampSec ?? Math.floor(Date.now() / 1000);
  return now >= refundReadyAt(placedAt, refundAfter);
}

/**
 * Returns user-facing label for an order status.
 */
export function statusLabel(status: number | OrderStatus): string {
  switch (Number(status)) {
    case OrderStatus.Placed:
      return "Placed";
    case OrderStatus.Fulfilled:
      return "Fulfilled";
    case OrderStatus.Declined:
      return "Declined";
    case OrderStatus.Refunded:
      return "Refunded";
    default:
      return "Unknown";
  }
}

export interface StatusBadge {
  label: string;
  tone: "placed" | "fulfilled" | "declined" | "refunded";
}

export function statusBadge(status: number | OrderStatus): StatusBadge {
  switch (Number(status)) {
    case OrderStatus.Placed:
      return { label: "Placed", tone: "placed" };
    case OrderStatus.Fulfilled:
      return { label: "Fulfilled", tone: "fulfilled" };
    case OrderStatus.Declined:
      return { label: "Declined", tone: "declined" };
    case OrderStatus.Refunded:
      return { label: "Refunded", tone: "refunded" };
    default:
      return { label: "Unknown", tone: "placed" };
  }
}

/**
 * Extracts the newly created orderId from a transaction receipt's Ordered log.
 * Filters to ensure the log came from the designated contract address.
 */
export function findOrderIdFromReceipt(
  receipt: { logs: readonly Log[] },
  contractAddress?: string
): bigint | null {
  if (!receipt || !receipt.logs) return null;

  for (const log of receipt.logs) {
    if (
      contractAddress &&
      log.address.toLowerCase() !== contractAddress.toLowerCase()
    ) {
      continue;
    }
    const parsed = parseOrderedLog(log);
    if (parsed) {
      return parsed.orderId;
    }
  }
  return null;
}

/**
 * Formats seconds into a clean human string (e.g. "1 hour", "24 hours", "7 days").
 */
export function formatRefundWindow(seconds: number): string {
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return `${mins} minute${mins === 1 ? "" : "s"}`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.round(seconds / 86400);
  return `${days} day${days === 1 ? "" : "s"}`;
}
