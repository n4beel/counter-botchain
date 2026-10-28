import { describe, expect, it } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseEther } from "viem";
import {
  encodeCode,
  decodeCode,
  orderTotal,
  refundReadyAt,
  isRefundReady,
  statusLabel,
  statusBadge,
  OrderStatus,
  formatRefundWindow,
  findOrderIdFromReceipt,
} from "../counter";
import { describeError } from "../errors";
import {
  parseShopOpenedLog,
  parseItemSetLog,
  parseOrderedLog,
  parseFulfilledLog,
  parseDeclinedLog,
  parseRefundedLog,
  parseWithdrawnLog,
} from "../logs";
import { counterAbi } from "../botchain/abi";

describe("encodeCode & decodeCode", () => {
  it("encodes and decodes readable codes cleanly", () => {
    const raw = "COFFEE_ROAST_1";
    const encoded = encodeCode(raw);
    expect(encoded.startsWith("0x")).toBe(true);
    expect(encoded.length).toBe(34); // 0x + 32 hex chars (16 bytes)

    const decoded = decodeCode(encoded);
    expect(decoded).toBe(raw);
  });

  it("handles short codes and strips padding null bytes", () => {
    const raw = "TEA";
    const encoded = encodeCode(raw);
    expect(decodeCode(encoded)).toBe("TEA");
  });

  it("truncates strings exceeding 16 bytes", () => {
    const long = "THIS_STRING_IS_WAY_TOO_LONG_FOR_BYTES16";
    const encoded = encodeCode(long);
    expect(decodeCode(encoded)).toBe("THIS_STRING_IS_W");
  });

  it("handles empty or invalid inputs gracefully", () => {
    expect(decodeCode("")).toBe("");
    expect(decodeCode("0x")).toBe("");
    expect(decodeCode("0x0")).toBe("");
  });
});

describe("orderTotal", () => {
  it("calculates price * qty correctly", () => {
    expect(orderTotal(parseEther("0.05"), 3)).toBe(parseEther("0.15"));
    expect(orderTotal(parseEther("1.0"), 1)).toBe(parseEther("1.0"));
    expect(orderTotal(parseEther("2.5"), 0)).toBe(0n);
  });
});

describe("refundReadyAt & isRefundReady", () => {
  it("computes refundReadyAt as placedAt + refundAfter", () => {
    expect(refundReadyAt(1000n, 3600)).toBe(4600);
    expect(refundReadyAt(1000, 7200)).toBe(8200);
  });

  it("accurately detects if refund deadline has passed", () => {
    const placed = 1000;
    const window = 3600; // ready at 4600

    expect(isRefundReady(placed, window, 4599)).toBe(false);
    expect(isRefundReady(placed, window, 4600)).toBe(true);
    expect(isRefundReady(placed, window, 5000)).toBe(true);
  });
});

describe("statusLabel & statusBadge", () => {
  it("returns correct labels and tones for each status", () => {
    expect(statusLabel(OrderStatus.Placed)).toBe("Placed");
    expect(statusLabel(OrderStatus.Fulfilled)).toBe("Fulfilled");
    expect(statusLabel(OrderStatus.Declined)).toBe("Declined");
    expect(statusLabel(OrderStatus.Refunded)).toBe("Refunded");
    expect(statusLabel(99)).toBe("Unknown");

    expect(statusBadge(OrderStatus.Placed)).toEqual({ label: "Placed", tone: "placed" });
    expect(statusBadge(OrderStatus.Fulfilled)).toEqual({ label: "Fulfilled", tone: "fulfilled" });
    expect(statusBadge(OrderStatus.Declined)).toEqual({ label: "Declined", tone: "declined" });
    expect(statusBadge(OrderStatus.Refunded)).toEqual({ label: "Refunded", tone: "refunded" });
  });
});

describe("formatRefundWindow", () => {
  it("formats minutes, hours, and days", () => {
    expect(formatRefundWindow(1800)).toBe("30 minutes");
    expect(formatRefundWindow(3600)).toBe("1 hour");
    expect(formatRefundWindow(7200)).toBe("2 hours");
    expect(formatRefundWindow(86400)).toBe("1 day");
    expect(formatRefundWindow(604800)).toBe("7 days");
  });
});

describe("describeError", () => {
  it("decodes WrongPayment with BOT amount", () => {
    const err = new Error("WrongPayment(50000000000000000)");
    expect(describeError(err)).toBe("This order is 0.05 BOT.");
  });

  it("decodes TooEarly with ready time", () => {
    const timestamp = 1700000000;
    const err = new Error(`TooEarly(${timestamp})`);
    expect(describeError(err)).toMatch(/You can claim a refund after \d{1,2}:\d{2}/);
  });

  it("decodes OwnerCannotOrder", () => {
    const err = new Error("execution reverted: OwnerCannotOrder");
    expect(describeError(err)).toBe("Shopkeepers cannot place orders at their own counter.");
  });

  it("decodes NoSuchItem", () => {
    const err = new Error("execution reverted: NoSuchItem");
    expect(describeError(err)).toBe("That item is no longer on the shelf.");
  });

  it("decodes user rejection and insufficient funds", () => {
    expect(describeError(new Error("User rejected the request"))).toBe(
      "Transaction was cancelled in wallet."
    );
    expect(describeError(new Error("insufficient funds for gas * price + value"))).toBe(
      "Insufficient BOT in wallet to pay transaction value and gas."
    );
  });
});

describe("Log Parsers & findOrderIdFromReceipt", () => {
  const dummyContract = "0x1234567890123456789012345678901234567890" as const;
  const otherContract = "0x9999999999999999999999999999999999999999" as const;

  it("parses Ordered log and extracts orderId from receipt", () => {
    const topics = encodeEventTopics({
      abi: counterAbi,
      eventName: "Ordered",
      args: {
        orderId: 42n,
        shopId: 1n,
        customer: "0x2222222222222222222222222222222222222222",
      },
    });

    const data = encodeAbiParameters(
      [
        { name: "item", type: "bytes16" },
        { name: "qty", type: "uint16" },
        { name: "amount", type: "uint128" },
      ],
      [encodeCode("COFFEE"), 2, parseEther("0.1")]
    );

    const log = {
      address: dummyContract,
      topics,
      data,
      blockHash: "0x1" as `0x${string}`,
      blockNumber: 1n,
      logIndex: 0,
      transactionHash: "0x2" as `0x${string}`,
      transactionIndex: 0,
      removed: false,
    };

    const parsed = parseOrderedLog(log);
    expect(parsed).not.toBeNull();
    expect(parsed?.orderId).toBe(42n);
    expect(parsed?.shopId).toBe(1n);
    expect(parsed?.qty).toBe(2);
    expect(parsed?.amount).toBe(parseEther("0.1"));

    // Receipt extraction with correct contract address
    const receipt = { logs: [log] };
    expect(findOrderIdFromReceipt(receipt, dummyContract)).toBe(42n);

    // Filtered out if address doesn't match
    expect(findOrderIdFromReceipt(receipt, otherContract)).toBeNull();
  });
});
