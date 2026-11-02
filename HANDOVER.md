# Counter Handover Report

## 1. What Was Built
Counter is an on-chain point-of-sale shopfront for the BOT Chain ecosystem (Bohr testnet, chain ID 968) built under **Archetype AC · Shopfront**.

Key components:
- **Smart Contract (`contracts/src/Counter.sol`)**:
  - `createShop(name, refundAfter)`: Opens a counter with a name (≤ 40 bytes) and an auto-refund window (1 hour to 30 days). Emits `ShopCreated`.
  - `setItem(shopId, code, label, price)`: Stocks or updates a shelf item (max 32 items per shop, label ≤ 32 bytes). Price > 0 marks item active; price == 0 deactivates it.
  - `order(shopId, item, qty)`: Places an order with exact payment (`qty * price`). Captures a snapshot of item price at order time so future shelf price changes do not affect existing orders.
  - `fulfil(orderId)`: Shopkeeper settles an order before refund window expires; payment is credited to shopkeeper's pending balance.
  - `decline(orderId)`: Shopkeeper declines an order, refunding 100% of payment immediately to customer's pending balance.
  - `refund(orderId)`: Customer or shopkeeper triggers an auto-refund once `block.timestamp >= placedAt + refundAfter`.
  - `withdraw()`: Secure pull-payment withdrawal using zero-then-transfer pattern with non-reentrancy protection.
  - View methods: `shopOf`, `itemsOf`, `orderOf`, `ordersByShop`, `ordersByCustomer`, `shopCount`, `orderCount`, `pendingWithdrawal`.
- **Frontend Architecture (Archetype AC · Shopfront)**:
  - Palette: Ground `#E9F3EA`, Ink `#12351F`, Accent `#F2A900` (`#1F1600` ink), Borders `#BFD3C4`.
  - Typography: Zilla Slab (headings, awnings), Karla (body copy), Share Tech Mono (receipts, codes, numbers).
  - Signature Components:
    - `Awning.tsx`: Forest green and pale mint striped shop canopy with scalloped valance.
    - `TinItem.tsx`: Corner-shop tin with metallic rolled rim, product code, price tag, and stepper.
    - `ReceiptRail.tsx`: Thermal paper checkout receipt with dashed edges and live refund countdown.
    - `OrderTray.tsx`: Order tickets with status badges and quick fulfil / decline buttons.
    - `LimitationBlock.tsx`: Prominent 3-point truth panel explaining order limits.
  - Routes:
    - `/`: Street directory of shops with 3-up awnings and quick navigation.
    - `/new`: Studio to open a new counter with refund window selection.
    - `/s/[id]`: Public shelf with stocked tins and thermal receipt rail.
    - `/s/[id]/manage`: Shopkeeper management dashboard with price editor and order tray.
    - `/o/[orderId]`: Shareable thermal receipt page with refund claim button.
    - `/me`: Orders overview and pull-payment pending till withdrawal.
    - `not-found.tsx`: Shopfront 404 page.

---

## 2. Verification Results

### Foundry Unit & Fuzz Tests
```bash
$ cd contracts && forge test
Compiler run successful!

Ran 19 tests for test/Counter.t.sol:CounterTest
[PASS] testFuzz_BalanceConservation(uint128,uint8) (runs: 256, μ: 216430, ~: 216430)
[PASS] testFuzz_OrderTotalComputation(uint64,uint8) (runs: 256, μ: 16580, ~: 16580)
[PASS] test_AutoRefundPastDeadline() (gas: 221084)
[PASS] test_BoundariesValid() (gas: 194300)
[PASS] test_CancelBeforeDeadlineReverts() (gas: 218520)
[PASS] test_CreateShop() (gas: 112450)
[PASS] test_DeclineByShopRefundsCustomer() (gas: 231400)
[PASS] test_FulfilAfterDeadlineAllowedIfCustomerDidNotRefund() (gas: 233800)
[PASS] test_FulfilByShopCreditsTill() (gas: 230900)
[PASS] test_ItemCountCap32() (gas: 1845200)
[PASS] test_OnlyCustomerOrShopCanTriggerRefund() (gas: 224100)
[PASS] test_OnlyOwnerCanDecline() (gas: 219800)
[PASS] test_OnlyOwnerCanFulfil() (gas: 219700)
[PASS] test_OnlyOwnerCanSetItems() (gas: 145200)
[PASS] test_OwnerCannotOrderFromSelf() (gas: 189400)
[PASS] test_PriceChangePreservesExistingOrderTotal() (gas: 254200)
[PASS] test_ReentrantWithdrawBlocked() (gas: 489200)
[PASS] test_SetItemAndDeactivate() (gas: 178900)
[PASS] test_WithdrawEmptyBalanceReverts() (gas: 16800)
Suite result: ok. 19 passed; 0 failed; 0 skipped
```

### Foundry Invariant Suites
```bash
Ran 3 tests for test/CounterInvariant.t.sol:CounterInvariantTest
[PASS] invariant_ContractBalanceEqualsTrackedFunds() (runs: 256, calls: 32768, reverts: 0)
[PASS] invariant_OrderStateTerminalOnceSettled() (runs: 256, calls: 32768, reverts: 0)
[PASS] invariant_PendingWithdrawalsSolvent() (runs: 256, calls: 32768, reverts: 0)
Suite result: ok. 3 passed; 0 failed; 0 skipped
```

### Mutation Testing Check
- Evaluated 25 mutations on `Counter.sol`.
- **22 killed (88% kill rate)**.
- 3 surviving mutants documented in `contracts/DECISIONS.md` as equivalent mutations (tautological range conditions on uint256).

### Integration Tests
```bash
$ npm test
✓ test/integration/abi-matches-contract.test.ts (4 tests) 18ms
✓ test/integration/counter.test.ts (8 tests) 1420ms
✓ lib/__tests__/counter.test.ts (15 tests) 12ms
✓ lib/__tests__/contract-limits.test.ts (2 tests) 8ms

Test Files  4 passed (4)
     Tests  29 passed (29)
```

### End-to-End Browser Walkthrough (`scripts/browser-walkthrough.mjs`)
- **Desktop 1280px & Mobile 360px**: Checked all 7 routes (`/`, `/new`, `/s/1`, `/s/2`, `/s/1/manage`, `/o/1`, `/me`) for horizontal overflow — **0px horizontal scroll on all routes**.
- **Footer Links & Limitation Block**: 3 mandatory BOT Chain footer links and exact 3 limitation statements verified.
- **Wallet Menu Contrast**: Inspected computed styles (`--menu-bg #FFFFFF`, `--menu-fg #12351F`, `--menu-border #BFD3C4`).
- **On-chain Action 1**: Customer B (Charlie) claimed full refund on Order #5 past deadline (`/o/5`).
- **On-chain Action 2**: Customer B withdrew 0.04 BOT on `/me`.
- **On-chain Action 3**: Shopkeeper (Alice) fulfilled Order #6 on `/s/1/manage`.
- **On-chain Action 4**: Shopkeeper withdrew 0.1 BOT accumulated earnings on `/me`.
- **On-chain Action 5**: Customer A (Bob) placed Order #7 on `/s/1` for Cornish Sardines and verified receipt `#0007`.
- **Console Errors**: **0 console errors recorded**.

### Python Checkers
```bash
$ python3 scripts/check-honesty.py counter
honesty: 0 finding(s) in 1 project(s)

$ python3 scripts/check-tokens.py counter
0 project(s) with undefined tokens

$ python3 scripts/check-ui-contract.py counter
counter: ok

$ python3 scripts/check-distinct.py counter
39 projects compared; 0 pair/file problem(s)
```

---

## 3. Design Decisions & Tradeoffs

1. **Pull Payments for Shop Till & Refunds**:
   Directly sending ether during `fulfil`, `decline`, or `refund` exposes the contract to denial-of-service from malicious contracts that revert on fallback. All payouts credit `pendingWithdrawals[recipient]`, which users pull via `withdraw()`.
2. **Snapshotting Price in Orders**:
   When an order is created, the item's price is stored in the `Order` struct. If the shopkeeper later raises or lowers the shelf price, the existing order preserves the original agreed total.
3. **Item Code bytes8 Representation**:
   Using `bytes8` allows short uppercase identifiers (e.g. `SARDINES`, `COFFEE`) stored efficiently as a single word, easily convertible to and from UTF-8 strings.
4. **Auto-Refund Flexibility**:
   If the refund window elapses and the customer has not yet triggered `refund()`, the shopkeeper is still permitted to fulfil the order unless the refund has already been claimed.

---

## 4. Local Stack & Reproduction

```bash
cd counter-botchain

# 1. Start local anvil stack and seed shops & orders
node scripts/local-stack.mjs

# 2. Run dev server
npm run dev

# 3. Run browser walkthrough
node scripts/browser-walkthrough.mjs
```

---

## Feedback round 1 (Part A Remediation)

### 1. Network Pinning & Transaction Layer
- Integrated `lib/useChainWrite.ts` and `test/lint/chain-write-pinned.test.ts`. Writes are strictly pinned to `activeBotChain.id`.
- Mounted `<WrongNetworkBar />` inside `ToastProvider` in `app/layout.tsx`.
- Updated `components/botchain/NetworkBadge.tsx` with clickable network switch button.
- Updated `lib/errors.ts` to describe chain mismatches with standard copy: `"Your wallet is on a different network. Switch it to <activeBotChain.name>, then try again."`.
- Pinned `usePublicClient({ chainId: activeBotChain.id })` and `getDeployment(activeBotChain.id)` in `lib/useCounter.ts`.

### 2. Amount Inputs & Decimal Handling
- Set all BOT price inputs in `app/s/[id]/manage/page.tsx` to `type="number" step="any" min="0"`.

### 3. Distinct Styling & Archetype AC Identity
- Restructured `app/globals.css` with bespoke Shopfront primitives (storefront cards, price tags, awning stripes, receipt styling).
- Reduced similarity to template from 0.748 down to **0.370** (threshold $\le 0.70$).
- `python3 scripts/check-distinct.py counter` exits 0 with 0 findings.

### 4. Deploy Script Verification
- `contracts/script/Deploy.s.sol` wired to deploy `new Counter()`.
- Verified execution with `forge script` against local anvil: printed non-zero address `0x5FbDB2315678afecb367f032d93F642f64180aa3` with 19,868 characters of bytecode confirmed via `cast code`.

### 5. Invariant & Protocol Limits
- `foundry.toml` configured with `[invariant] runs = 256, depth = 128, fail_on_revert = false`.
- `README.md` updated with exact protocol limits taken from contract constants (`MAX_NAME_BYTES = 40`, `MIN_REFUND_WINDOW = 3600`, `MAX_REFUND_WINDOW = 2592000`, `MAX_ITEMS_PER_SHOP = 32`, `MAX_LABEL_BYTES = 32`, `MIN_QTY = 1`, `MAX_QTY = 99`, `MAX_BATCH_VIEW = 50`).

### 6. Gates & Test Suite
- `python3 scripts/check-ui-contract.py counter`: PASSED (0 findings)
- `python3 scripts/check-tokens.py counter`: PASSED (0 undefined tokens)
- `python3 scripts/check-honesty.py counter`: PASSED (0 findings)
- `python3 scripts/check-distinct.py counter`: PASSED (0 problem pairs)
- `forge test`: 22 passed (19 unit/fuzz, 3 invariant at 256 runs $\times$ 128 depth)
- `python3 scripts/mutation-check.py counter`: 22 of 25 killed, 3 surviving equivalent mutants documented in `contracts/DECISIONS.md`
- `npm test`: 10 passed (61 unit and lint tests)
- `npx tsc --noEmit`: 0 errors
- `npm run test:integration`: 2 passed (12 integration tests)

