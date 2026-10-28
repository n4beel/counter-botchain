// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterHandler is Test {
    Counter public counter;

    address[] public shops;
    address[] public customers;
    uint256[] public shopIds;
    uint256[] public orderIds;

    bytes16[] public itemCodes;

    mapping(uint256 => uint128) public recordedOrderAmount;
    mapping(uint256 => Counter.Status) public recordedOrderStatus;

    constructor(Counter _counter) {
        counter = _counter;

        shops.push(address(0x1001));
        shops.push(address(0x1002));

        customers.push(address(0x2001));
        customers.push(address(0x2002));
        customers.push(address(0x2003));

        for (uint256 i = 0; i < shops.length; i++) {
            vm.deal(shops[i], 1000 ether);
        }
        for (uint256 i = 0; i < customers.length; i++) {
            vm.deal(customers[i], 1000 ether);
        }

        itemCodes.push(bytes16("ITEM_01"));
        itemCodes.push(bytes16("ITEM_02"));
        itemCodes.push(bytes16("ITEM_03"));

        // Pre-open 2 shops
        for (uint256 i = 0; i < shops.length; i++) {
            vm.prank(shops[i]);
            uint256 sid = counter.openShop(i == 0 ? "Bakery" : "Green Grocer", 3600);
            shopIds.push(sid);

            // Add items
            vm.startPrank(shops[i]);
            counter.setItem(sid, itemCodes[0], "Bread", 0.02 ether);
            counter.setItem(sid, itemCodes[1], "Roll", 0.01 ether);
            counter.setItem(sid, itemCodes[2], "Cake", 0.05 ether);
            vm.stopPrank();
        }
    }

    function placeOrder(
        uint256 custIdx,
        uint256 shopIdx,
        uint256 itemIdx,
        uint16 qty
    ) external {
        if (shopIds.length == 0) return;
        uint256 sId = shopIds[shopIdx % shopIds.length];
        address cust = customers[custIdx % customers.length];
        bytes16 code = itemCodes[itemIdx % itemCodes.length];
        qty = uint16(bound(qty, 1, 10));

        Counter.Shop memory s = counter.shopOf(sId);
        if (cust == s.owner) return;

        Counter.Item[] memory items = counter.itemsOf(sId);
        uint128 price = 0;
        bool found = false;
        for (uint256 i = 0; i < items.length; i++) {
            if (items[i].code == code && items[i].active) {
                price = items[i].price;
                found = true;
                break;
            }
        }
        if (!found || price == 0) return;

        uint256 total = uint256(price) * uint256(qty);
        if (cust.balance < total) return;

        vm.prank(cust);
        uint256 oId = counter.order{value: total}(sId, code, qty);
        orderIds.push(oId);
        recordedOrderAmount[oId] = uint128(total);
        recordedOrderStatus[oId] = Counter.Status.Placed;
    }

    function fulfilOrder(uint256 orderIdx) external {
        if (orderIds.length == 0) return;
        uint256 oId = orderIds[orderIdx % orderIds.length];

        Counter.Order memory o = counter.orderOf(oId);
        if (o.status != Counter.Status.Placed) return;

        Counter.Shop memory s = counter.shopOf(o.shopId);
        vm.prank(s.owner);
        counter.fulfil(oId);
        recordedOrderStatus[oId] = Counter.Status.Fulfilled;
    }

    function declineOrder(uint256 orderIdx) external {
        if (orderIds.length == 0) return;
        uint256 oId = orderIds[orderIdx % orderIds.length];

        Counter.Order memory o = counter.orderOf(oId);
        if (o.status != Counter.Status.Placed) return;

        Counter.Shop memory s = counter.shopOf(o.shopId);
        vm.prank(s.owner);
        counter.decline(oId);
        recordedOrderStatus[oId] = Counter.Status.Declined;
    }

    function refundOrder(uint256 orderIdx, uint32 advanceSeconds) external {
        if (orderIds.length == 0) return;
        uint256 oId = orderIds[orderIdx % orderIds.length];

        Counter.Order memory o = counter.orderOf(oId);
        if (o.status != Counter.Status.Placed) return;

        Counter.Shop memory s = counter.shopOf(o.shopId);
        uint64 readyAt = o.placedAt + s.refundAfter;

        advanceSeconds = uint32(bound(advanceSeconds, 0, 7 days));
        if (block.timestamp + advanceSeconds < readyAt) {
            vm.warp(readyAt + 1);
        } else {
            vm.warp(block.timestamp + advanceSeconds);
        }

        vm.prank(o.customer);
        counter.refund(oId);
        recordedOrderStatus[oId] = Counter.Status.Refunded;
    }

    function withdrawActor(uint256 actorIdx) external {
        address actor;
        if (actorIdx % 2 == 0) {
            actor = shops[(actorIdx / 2) % shops.length];
        } else {
            actor = customers[(actorIdx / 2) % customers.length];
        }

        if (counter.pending(actor) == 0) return;

        vm.prank(actor);
        counter.withdraw();
    }

    function changePrice(
        uint256 shopIdx,
        uint256 itemIdx,
        uint128 newPrice
    ) external {
        if (shopIds.length == 0) return;
        uint256 sId = shopIds[shopIdx % shopIds.length];
        bytes16 code = itemCodes[itemIdx % itemCodes.length];
        newPrice = uint128(bound(newPrice, 0, 1 ether));

        Counter.Shop memory s = counter.shopOf(sId);
        vm.prank(s.owner);
        counter.setItem(sId, code, "Updated Item", newPrice);
    }

    function allOrderIds() external view returns (uint256[] memory) {
        return orderIds;
    }

    function allActors() external view returns (address[] memory) {
        uint256 total = shops.length + customers.length;
        address[] memory res = new address[](total);
        for (uint256 i = 0; i < shops.length; i++) {
            res[i] = shops[i];
        }
        for (uint256 i = 0; i < customers.length; i++) {
            res[shops.length + i] = customers[i];
        }
        return res;
    }
}

contract CounterInvariantTest is Test {
    Counter public counter;
    CounterHandler public handler;

    function setUp() public {
        counter = new Counter();
        handler = new CounterHandler(counter);
        targetContract(address(handler));
    }

    /**
     * @notice Invariant: Contract balance must equal sum(pending) + sum(amount of Placed orders)
     */
    function invariant_SolvencyAndConservation() public view {
        uint256 totalPending = 0;
        address[] memory actors = handler.allActors();
        for (uint256 i = 0; i < actors.length; i++) {
            totalPending += counter.pending(actors[i]);
        }

        uint256 totalPlaced = 0;
        uint256[] memory oIds = handler.allOrderIds();
        for (uint256 i = 0; i < oIds.length; i++) {
            Counter.Order memory o = counter.orderOf(oIds[i]);
            if (o.status == Counter.Status.Placed) {
                totalPlaced += o.amount;
            }
        }

        assertEq(
            address(counter).balance,
            totalPending + totalPlaced,
            "Solvency invariant violated"
        );
    }

    /**
     * @notice Invariant: Placed order amount never changes after placement
     */
    function invariant_OrderAmountImmutable() public view {
        uint256[] memory oIds = handler.allOrderIds();
        for (uint256 i = 0; i < oIds.length; i++) {
            Counter.Order memory o = counter.orderOf(oIds[i]);
            assertEq(
                o.amount,
                handler.recordedOrderAmount(oIds[i]),
                "Order amount altered"
            );
        }
    }

    /**
     * @notice Invariant: Once an order resolves to Fulfilled, Declined, or Refunded, it stays in that terminal state.
     * Owner cannot fulfil an already refunded order.
     */
    function invariant_TerminalStateFinality() public view {
        uint256[] memory oIds = handler.allOrderIds();
        for (uint256 i = 0; i < oIds.length; i++) {
            Counter.Order memory o = counter.orderOf(oIds[i]);
            Counter.Status expected = handler.recordedOrderStatus(oIds[i]);
            assertEq(uint256(o.status), uint256(expected), "Status mismatch");
        }
    }
}
