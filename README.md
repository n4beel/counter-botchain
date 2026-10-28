# Counter

> A shop counter. Unfilled orders refund themselves.

A point-of-sale shopfront application where shopkeepers stock items in labelled tins and customers place orders that auto-refund if not fulfilled before a customer-verifiable refund window. Built for the BOT Chain ecosystem under **Archetype AC · Shopfront**.

## What it is

A shopkeeper opens a **counter** on BOT Chain, specifying a shop name (up to 40 bytes) and an auto-refund window (between 1 hour and 30 days). The shop stocks up to 32 items on its shelf, each represented by a bytes8 code, human-readable label (up to 32 bytes), and unit price in BOT.

When a customer orders an item, their payment is locked directly in the contract.
- The shopkeeper can **fulfil** the order before the refund window expires, crediting the payment to their pending till balance.
- The shopkeeper can **decline** an order at any time, immediately releasing the full payment back to the customer's pending balance.
- If the shopkeeper takes no action and the refund window passes, the customer can trigger **`refund(orderId)`** on-chain to reclaim 100% of their payment.
- Unfilled orders preserve their original price on the receipt even if the shelf price is later updated by the shopkeeper.

All balances are withdrawn via secure, reentrancy-guarded pull payments.

## Archetype AC · Shopfront

- **Ground**: Pale green `#E9F3EA`
- **Surface**: Pure white `#FFFFFF` / Soft mint elevated `#F4F8F4`
- **Ink**: Forest ink `#12351F`
- **Accent**: Marigold price tag `#F2A900` (`#1F1600` ink)
- **Borders**: Subdued leaf `#BFD3C4`
- **Wallet Menu**: `--menu-bg #FFFFFF` · `--menu-fg #12351F` · `--menu-muted #41604B` · `--menu-border #BFD3C4` · `--menu-hover-bg #E6F2E8` · `--menu-danger #B3261E`
- **Typography**: Zilla Slab (store awnings & headings), Karla (body & copy), Share Tech Mono (thermal receipts, codes, prices).

## Signature Components

- **Striped Awning (`Awning.tsx`)**: Canopy striped in forest ink and ground mint, with scalloped bottom valance, brass ring grommets, and gilded signage.
- **Labelled Tin (`TinItem.tsx`)**: Tactile corner-shop tin with rolled metallic rim, uppercase product code, bold label, marigold price tag hanging off the corner, and accessible +/- quantity stepper.
- **Thermal Receipt Rail (`ReceiptRail.tsx`)**: Thermal-paper checkout receipt with zigzag/dashed edges, monospace itemized lines, live countdown timer, and refund action button.
- **Order Tray (`OrderTray.tsx`)**: Shopkeeper ticket rack displaying incoming orders with status badges, customer addresses, time placed, refund deadline, and single-click Fulfil / Decline buttons.
- **Limitation Block (`LimitationBlock.tsx`)**: Prominent 3-point truth panel:
  1. *The shop says when an order is filled* (the chain only knows the shop signed fulfil, not whether physical goods moved).
  2. *Prices can change. Your order keeps the price you paid* (existing orders preserve their agreed cost).
  3. *One order, one amount. No part-refunds* (refunds are binary and full).

## Contract Architecture (`contracts/src/Counter.sol`)

- `createShop(name, refundAfter) returns (shopId)`: Opens a new counter (1h ≤ window ≤ 30d, name ≤ 40 bytes).
- `setItem(shopId, code, label, price)`: Stocks or edits a shelf item (active if price > 0, deactivated if price == 0). Max 32 items per shop.
- `order(shopId, item, qty) payable returns (orderId)`: Places an order with exact payment (`qty * price`). Stores snapshot of unit price.
- `fulfil(orderId)`: Shopkeeper marks order fulfilled, moving payment into shopkeeper's pending balance.
- `decline(orderId)`: Shopkeeper declines order, refunding customer to pending balance immediately.
- `refund(orderId)`: Customer or shopkeeper refunds an unfulfilled order once block timestamp passes `placedAt + refundAfter`.
- `withdraw()`: Non-reentrant pull payment withdrawal for customers and shopkeepers.
- Views: `shopOf`, `itemsOf`, `orderOf`, `ordersByShop`, `ordersByCustomer`, `shopCount`, `orderCount`, `pendingWithdrawal`.

## Verification & Testing

- **Foundry Contracts**: 19 unit & fuzz tests + 3 stateful invariant suites (32,768 calls each across 256 runs) passing with 0 reverts.
- **Mutation Check**: 22/25 mutants killed (88% kill rate, remaining 3 documented equivalent mutants).
- **Integration**: 4 ABI type matching tests + 8 on-chain integration tests passing on port `8624`.
- **Browser Walkthrough**: Automated Headless Chrome CDP walkthrough across Desktop (1280px) and Mobile (360px) verifying 0px overflow, footer links, limitation copy, ticket fulfilment, refund past deadline, customer and shopkeeper withdrawals, and fresh order placement with **0 console errors**.
