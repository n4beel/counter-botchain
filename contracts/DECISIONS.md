# Counter Contract Design Decisions

## 1. Architectural Decisions

### 1.1 Shop Counter & Price Guarantees
- A shopkeeper creates a shop via `openShop(name, refundAfter)` with an operational refund deadline window (`MIN_REFUND_WINDOW = 1 hours`, `MAX_REFUND_WINDOW = 30 days`).
- The shopkeeper sets up to 32 items via `setItem(shopId, code, label, price)`. Setting `price = 0` cleanly deactivates an item from customer order placement.
- When an order is placed (`order(shopId, item, qty)`), the contract locks `amount = price * qty` into the `Order` struct.
- Even if the shopkeeper subsequently alters the price of an item or deactivates it, existing placed orders preserve their recorded price and payment amount permanently.

### 1.2 Fulfil, Decline, and Auto-Refund Exclusivity
- Three potential resolution paths exist for any placed order:
  1. `fulfil(orderId)`: The shop owner marks the order fulfilled. Payment moves to `pending[shopOwner]`.
  2. `decline(orderId)`: The shop owner rejects the order immediately. Payment moves to `pending[customer]`.
  3. `refund(orderId)`: If the shop neither fulfils nor declines before `placedAt + refundAfter`, the customer triggers their own instant refund. Payment moves to `pending[customer]`.
- All three resolutions are strictly exclusive: once transitioned from `Status.Placed` to any terminal state, the order cannot be re-acted upon. The shop cannot fulfil an order that the customer has already refunded.

### 1.3 Pull Payments & Non-Reentrancy
- All value payouts (whether to the shopkeeper upon fulfilment or to the customer upon decline/refund) credit the `pending` mapping.
- Payouts are retrieved by the beneficiary via `withdraw()`, implementing the zero-before-transfer pattern with a non-reentrant guard (`ReentrantCall`).
- Reentrant attempts to drain the contract during `withdraw()` are prevented and verified via explicit test cases.

### 1.4 Limits and Storage Bounds
- `MAX_NAME_BYTES = 40` bytes for shop name.
- `MIN_REFUND_WINDOW = 3600` seconds (1 hour), `MAX_REFUND_WINDOW = 2592000` seconds (30 days).
- `MAX_ITEMS_PER_SHOP = 32` items per shop.
- `MAX_LABEL_BYTES = 32` bytes for item label.
- `MIN_QTY = 1`, `MAX_QTY = 99` units per order.
- `MAX_BATCH_VIEW = 50` for bounded batch view queries (`latestShops`, `ordersByShop`, `ordersByCustomer`).

---

## 2. Invariants

1. **Conservation & Solvency:**
   At all times, the contract's native balance equals the sum of all pending pull balances plus all placed orders:
   `address(counter).balance == sum(pending) + sum(amount of Placed orders)`.

2. **Order Amount Immutability:**
   Once placed, an order's `amount` is permanently fixed and unaffected by item updates or price shifts.

3. **Terminal State Finality:**
   Orders resolve exactly once into `Fulfilled`, `Declined`, or `Refunded`. An order in any terminal status cannot transition again. Specifically, the shopkeeper cannot fulfil an already refunded or declined order.

---

## 3. Mutation Testing Analysis

Evaluated using `python3 scripts/mutation-check.py counter --max 25`:
- **Mutants Tested:** 25
- **Mutants Killed:** 22
- **Surviving Mutants:** 3

### Surviving Mutant Analysis:
1. `Counter.sol:405` — `uint256 n = count < maxAvailable ? count : maxAvailable; => count <= maxAvailable ? count : maxAvailable;`
   - When `count == maxAvailable`, both branches return `count`. Mathematically and semantically equivalent.
2. `Counter.sol:347` & `Counter.sol:373` — `if (count > MAX_BATCH_VIEW) count = MAX_BATCH_VIEW; => if (count >= MAX_BATCH_VIEW) count = MAX_BATCH_VIEW;`
   - When `count == 50`, assigning `count = 50` produces identical runtime state. Equivalent mutants.

Effective functional mutation kill rate: **100%**.
