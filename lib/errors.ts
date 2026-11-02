import { activeBotChain } from "@/lib/botchain/chain";
import { formatEther } from "viem";

/**
 * User-facing error decoders for Counter.
 * Follows spec §4 copy guidelines.
 */
export function describeError(err: unknown): string {
  // A wallet on the other BOT Chain network: writes are pinned to this build's chain (lib/useChainWrite.ts), so wagmi
  // refuses before the wallet opens. Say what to do, not the library's name for it.
  if (/ConnectorChainMismatch|chain mismatch|does not match the target chain/i.test(err instanceof Error ? `${err.name} ${err.message}` : String(err))) {
    return `Your wallet is on a different network. Switch it to ${activeBotChain.name}, then try again.`;
  }
  if (!err) return "An unexpected error occurred.";

  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction was cancelled in wallet.";
  }

  if (msg.includes("WrongPayment")) {
    const match = msg.match(/expected:\s*(\d+)/i) || msg.match(/WrongPayment\((\d+)\)/);
    if (match && match[1]) {
      const expectedBot = formatEther(BigInt(match[1]));
      return `This order is ${expectedBot} BOT.`;
    }
    return "Incorrect payment amount for this order.";
  }

  if (msg.includes("TooEarly")) {
    const match = msg.match(/readyAt:\s*(\d+)/i) || msg.match(/TooEarly\((\d+)\)/);
    if (match && match[1]) {
      const readyDate = new Date(Number(match[1]) * 1000);
      const readyTime = readyDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `You can claim a refund after ${readyTime}.`;
    }
    return "You can claim a refund once the refund window has passed.";
  }

  if (msg.includes("OwnerCannotOrder")) {
    return "Shopkeepers cannot place orders at their own counter.";
  }

  if (msg.includes("NoSuchItem")) {
    return "That item is no longer on the shelf.";
  }

  if (msg.includes("NameTooLong")) {
    return "Shop name exceeds maximum length (40 bytes).";
  }

  if (msg.includes("EmptyName")) {
    return "Shop name cannot be empty.";
  }

  if (msg.includes("BadRefundWindow")) {
    return "Refund window must be between 1 hour and 30 days.";
  }

  if (msg.includes("NoSuchShop")) {
    return "Shop not found.";
  }

  if (msg.includes("TooManyItems")) {
    return "Shop shelf is full (maximum 32 items).";
  }

  if (msg.includes("EmptyCode")) {
    return "Item code cannot be empty.";
  }

  if (msg.includes("LabelTooLong")) {
    return "Item label exceeds maximum length (32 bytes).";
  }

  if (msg.includes("NotOwner")) {
    return "Only the shopkeeper can manage this shelf or fulfil orders.";
  }

  if (msg.includes("BadQty")) {
    return "Quantity must be between 1 and 99.";
  }

  if (msg.includes("NoSuchOrder")) {
    return "Order not found.";
  }

  if (msg.includes("NotPlaced")) {
    return "This order is no longer pending.";
  }

  if (msg.includes("NotCustomer")) {
    return "Only the customer who placed this order can claim a refund.";
  }

  if (msg.includes("NothingToWithdraw")) {
    return "No pending balance available to withdraw.";
  }

  if (msg.includes("TransferFailed")) {
    return "BOT transfer failed.";
  }

  if (msg.includes("ReentrantCall")) {
    return "Reentrant call prevented.";
  }

  if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
    return "Insufficient BOT in wallet to pay transaction value and gas.";
  }

  return msg.length > 140 ? `${msg.slice(0, 137)}…` : msg;
}
