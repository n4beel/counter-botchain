/**
 * Counter contract ABI.
 * Typed with `as const` for complete viem / wagmi inference.
 */
export const counterAbi = [
  // --- Functions ---
  {
    type: "function",
    name: "openShop",
    inputs: [
      { name: "name", type: "string" },
      { name: "refundAfter", type: "uint32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setItem",
    inputs: [
      { name: "shopId", type: "uint256" },
      { name: "code", type: "bytes16" },
      { name: "label", type: "string" },
      { name: "price", type: "uint128" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "order",
    inputs: [
      { name: "shopId", type: "uint256" },
      { name: "item", type: "bytes16" },
      { name: "qty", type: "uint16" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "fulfil",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decline",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refund",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // --- Views ---
  {
    type: "function",
    name: "pending",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "shopCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "orderCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "shopOf",
    inputs: [{ name: "shopId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "refundAfter", type: "uint32" },
          { name: "itemCount", type: "uint8" },
          { name: "name", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "itemsOf",
    inputs: [{ name: "shopId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "price", type: "uint128" },
          { name: "active", type: "bool" },
          { name: "code", type: "bytes16" },
          { name: "label", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "orderOf",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "shopId", type: "uint256" },
          { name: "customer", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "placedAt", type: "uint64" },
          { name: "item", type: "bytes16" },
          { name: "qty", type: "uint16" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ordersByShop",
    inputs: [
      { name: "shopId", type: "uint256" },
      { name: "offset", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "orders",
        type: "tuple[]",
        components: [
          { name: "shopId", type: "uint256" },
          { name: "customer", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "placedAt", type: "uint64" },
          { name: "item", type: "bytes16" },
          { name: "qty", type: "uint16" },
          { name: "status", type: "uint8" },
        ],
      },
      { name: "ids", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ordersByCustomer",
    inputs: [
      { name: "customer", type: "address" },
      { name: "offset", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "orders",
        type: "tuple[]",
        components: [
          { name: "shopId", type: "uint256" },
          { name: "customer", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "placedAt", type: "uint64" },
          { name: "item", type: "bytes16" },
          { name: "qty", type: "uint16" },
          { name: "status", type: "uint8" },
        ],
      },
      { name: "ids", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "latestShops",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "shops",
        type: "tuple[]",
        components: [
          { name: "owner", type: "address" },
          { name: "refundAfter", type: "uint32" },
          { name: "itemCount", type: "uint8" },
          { name: "name", type: "string" },
        ],
      },
      { name: "ids", type: "uint256[]" },
    ],
    stateMutability: "view",
  },

  // --- Events ---
  {
    type: "event",
    name: "ShopOpened",
    inputs: [
      { indexed: true, name: "shopId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "refundAfter", type: "uint32" },
    ],
  },
  {
    type: "event",
    name: "ItemSet",
    inputs: [
      { indexed: true, name: "shopId", type: "uint256" },
      { indexed: true, name: "code", type: "bytes16" },
      { indexed: false, name: "label", type: "string" },
      { indexed: false, name: "price", type: "uint128" },
    ],
  },
  {
    type: "event",
    name: "Ordered",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "shopId", type: "uint256" },
      { indexed: true, name: "customer", type: "address" },
      { indexed: false, name: "item", type: "bytes16" },
      { indexed: false, name: "qty", type: "uint16" },
      { indexed: false, name: "amount", type: "uint128" },
    ],
  },
  {
    type: "event",
    name: "Fulfilled",
    inputs: [{ indexed: true, name: "orderId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Declined",
    inputs: [{ indexed: true, name: "orderId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [{ indexed: true, name: "orderId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      { indexed: true, name: "who", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },

  // --- Errors ---
  { type: "error", name: "NameTooLong", inputs: [] },
  { type: "error", name: "EmptyName", inputs: [] },
  { type: "error", name: "BadRefundWindow", inputs: [] },
  { type: "error", name: "NoSuchShop", inputs: [] },
  { type: "error", name: "TooManyItems", inputs: [] },
  { type: "error", name: "EmptyCode", inputs: [] },
  { type: "error", name: "LabelTooLong", inputs: [] },
  { type: "error", name: "NotOwner", inputs: [] },
  { type: "error", name: "NoSuchItem", inputs: [] },
  { type: "error", name: "BadQty", inputs: [] },
  { type: "error", name: "OwnerCannotOrder", inputs: [] },
  {
    type: "error",
    name: "WrongPayment",
    inputs: [{ name: "expected", type: "uint128" }],
  },
  { type: "error", name: "NoSuchOrder", inputs: [] },
  { type: "error", name: "NotPlaced", inputs: [] },
  { type: "error", name: "NotCustomer", inputs: [] },
  {
    type: "error",
    name: "TooEarly",
    inputs: [{ name: "readyAt", type: "uint64" }],
  },
  { type: "error", name: "NothingToWithdraw", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "ReentrantCall", inputs: [] },
] as const;

export const contractAbi = counterAbi;
