import { decodeEventLog, type Log } from "viem";
import { counterAbi } from "./botchain/abi";

export interface ShopOpenedEvent {
  shopId: bigint;
  owner: `0x${string}`;
  name: string;
  refundAfter: number;
}

export interface ItemSetEvent {
  shopId: bigint;
  code: `0x${string}`;
  label: string;
  price: bigint;
}

export interface OrderedEvent {
  orderId: bigint;
  shopId: bigint;
  customer: `0x${string}`;
  item: `0x${string}`;
  qty: number;
  amount: bigint;
}

export interface FulfilledEvent {
  orderId: bigint;
}

export interface DeclinedEvent {
  orderId: bigint;
}

export interface RefundedEvent {
  orderId: bigint;
}

export interface WithdrawnEvent {
  who: `0x${string}`;
  amount: bigint;
}

export function parseShopOpenedLog(log: Log): ShopOpenedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "ShopOpened",
    });
    return {
      shopId: decoded.args.shopId,
      owner: decoded.args.owner,
      name: decoded.args.name,
      refundAfter: Number(decoded.args.refundAfter),
    };
  } catch {
    return null;
  }
}

export function parseItemSetLog(log: Log): ItemSetEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "ItemSet",
    });
    return {
      shopId: decoded.args.shopId,
      code: decoded.args.code,
      label: decoded.args.label,
      price: decoded.args.price,
    };
  } catch {
    return null;
  }
}

export function parseOrderedLog(log: Log): OrderedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Ordered",
    });
    return {
      orderId: decoded.args.orderId,
      shopId: decoded.args.shopId,
      customer: decoded.args.customer,
      item: decoded.args.item,
      qty: Number(decoded.args.qty),
      amount: decoded.args.amount,
    };
  } catch {
    return null;
  }
}

export function parseFulfilledLog(log: Log): FulfilledEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Fulfilled",
    });
    return {
      orderId: decoded.args.orderId,
    };
  } catch {
    return null;
  }
}

export function parseDeclinedLog(log: Log): DeclinedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Declined",
    });
    return {
      orderId: decoded.args.orderId,
    };
  } catch {
    return null;
  }
}

export function parseRefundedLog(log: Log): RefundedEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Refunded",
    });
    return {
      orderId: decoded.args.orderId,
    };
  } catch {
    return null;
  }
}

export function parseWithdrawnLog(log: Log): WithdrawnEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: counterAbi,
      data: log.data,
      topics: log.topics,
      eventName: "Withdrawn",
    });
    return {
      who: decoded.args.who,
      amount: decoded.args.amount,
    };
  } catch {
    return null;
  }
}
