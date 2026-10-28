// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Counter.sol";

contract MaliciousRecipient {
    Counter public counter;
    bytes public lastRevertData;

    constructor(Counter _counter) {
        counter = _counter;
    }

    function attack() external {
        counter.withdraw();
    }

    receive() external payable {
        try counter.withdraw() {} catch (bytes memory reason) {
            lastRevertData = reason;
        }
    }
}

contract CounterTest is Test {
    Counter public counter;

    address public owner = address(0x1111);
    address public alice = address(0x2222);
    address public bob = address(0x3333);
    address public charlie = address(0x4444);

    bytes16 public constant ITEM_A = bytes16("COFFEE_ROAST_1");
    bytes16 public constant ITEM_B = bytes16("CROISSANT_01");

    function setUp() public {
        counter = new Counter();
        vm.deal(owner, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
    }

    // --- Shop Creation ---

    function test_OpenShop() public {
        vm.prank(owner);
        uint256 id = counter.openShop("Corner Grocer", 3600);
        assertEq(id, 1);
        assertEq(counter.shopCount(), 1);

        Counter.Shop memory s = counter.shopOf(1);
        assertEq(s.owner, owner);
        assertEq(s.refundAfter, 3600);
        assertEq(s.itemCount, 0);
        assertEq(s.name, "Corner Grocer");
    }

    function test_OpenShop_Reverts() public {
        // Empty name
        vm.expectRevert(Counter.EmptyName.selector);
        counter.openShop("", 3600);

        // Name too long (> 40 bytes)
        vm.expectRevert(Counter.NameTooLong.selector);
        counter.openShop("12345678901234567890123456789012345678901", 3600);

        // Refund window too short (< 1 hour)
        vm.expectRevert(Counter.BadRefundWindow.selector);
        counter.openShop("Shop", 3599);

        // Refund window too long (> 30 days)
        vm.expectRevert(Counter.BadRefundWindow.selector);
        counter.openShop("Shop", 2592001);
    }

    function test_OpenShop_Boundaries() public {
        // Exact 40 bytes name
        string memory exact40 = "1234567890123456789012345678901234567890";
        assertEq(bytes(exact40).length, 40);
        uint256 id1 = counter.openShop(exact40, 3600);
        assertEq(counter.shopOf(id1).name, exact40);

        // Exact MIN_REFUND_WINDOW (3600)
        uint256 id2 = counter.openShop("Min Window Shop", 3600);
        assertEq(counter.shopOf(id2).refundAfter, 3600);

        // Exact MAX_REFUND_WINDOW (2592000 = 30 days)
        uint256 id3 = counter.openShop("Max Window Shop", 2592000);
        assertEq(counter.shopOf(id3).refundAfter, 2592000);
    }

    // --- Items ---

    function test_OnlyOwnerSetsItems() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Corner Grocer", 3600);

        // Non-owner cannot set item
        vm.prank(alice);
        vm.expectRevert(Counter.NotOwner.selector);
        counter.setItem(shopId, ITEM_A, "Espresso", 0.05 ether);

        // Owner can set item
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Espresso", 0.05 ether);

        Counter.Item[] memory items = counter.itemsOf(shopId);
        assertEq(items.length, 1);
        assertEq(items[0].code, ITEM_A);
        assertEq(items[0].label, "Espresso");
        assertEq(items[0].price, 0.05 ether);
        assertTrue(items[0].active);
    }

    function test_ItemCapAt32() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("General Store", 3600);

        vm.startPrank(owner);
        for (uint256 i = 0; i < 32; i++) {
            bytes16 code = bytes16(keccak256(abi.encodePacked(i)));
            counter.setItem(shopId, code, "Item", 0.01 ether);
        }

        // 33rd item reverts
        bytes16 extra = bytes16(keccak256(abi.encodePacked(uint256(999))));
        vm.expectRevert(Counter.TooManyItems.selector);
        counter.setItem(shopId, extra, "Item 33", 0.01 ether);

        // Updating an existing item does NOT revert
        bytes16 first = bytes16(keccak256(abi.encodePacked(uint256(0))));
        counter.setItem(shopId, first, "Updated Item 0", 0.02 ether);
        vm.stopPrank();

        Counter.Shop memory s = counter.shopOf(shopId);
        assertEq(s.itemCount, 32);
    }

    function test_SetItem_Validations() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        // Empty code
        vm.prank(owner);
        vm.expectRevert(Counter.EmptyCode.selector);
        counter.setItem(shopId, bytes16(0), "Label", 0.01 ether);

        // Label too long (> 32 bytes)
        vm.prank(owner);
        vm.expectRevert(Counter.LabelTooLong.selector);
        counter.setItem(shopId, ITEM_A, "123456789012345678901234567890123", 0.01 ether);

        // Exact 32 bytes label
        string memory exact32 = "12345678901234567890123456789012";
        assertEq(bytes(exact32).length, 32);
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, exact32, 0.01 ether);
        assertEq(counter.itemsOf(shopId)[0].label, exact32);

        // Deactivating item with price = 0
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Espresso", 0.05 ether);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Espresso (Off Shelf)", 0);

        Counter.Item[] memory items = counter.itemsOf(shopId);
        assertFalse(items[0].active);
        assertEq(items[0].price, 0);

        // Re-activating item
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Espresso (Back)", 0.06 ether);
        items = counter.itemsOf(shopId);
        assertTrue(items[0].active);
        assertEq(items[0].price, 0.06 ether);
    }

    // --- Ordering ---

    function test_OrderStoresPriceAtPlacement() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Corner Grocer", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Espresso", 0.05 ether);

        // Alice orders 2 coffees at 0.05 ether each = 0.10 ether
        vm.prank(alice);
        uint256 orderId = counter.order{value: 0.10 ether}(shopId, ITEM_A, 2);

        Counter.Order memory o = counter.orderOf(orderId);
        assertEq(o.amount, 0.10 ether);
        assertEq(o.qty, 2);
        assertEq(uint256(o.status), uint256(Counter.Status.Placed));

        // Shop changes coffee price to 0.08 ether
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Espresso", 0.08 ether);

        // Bob orders at the new price
        vm.prank(bob);
        uint256 bobOrderId = counter.order{value: 0.16 ether}(shopId, ITEM_A, 2);
        Counter.Order memory oBob = counter.orderOf(bobOrderId);
        assertEq(oBob.amount, 0.16 ether);

        // Alice's order still retains 0.10 ether
        Counter.Order memory oAlice = counter.orderOf(orderId);
        assertEq(oAlice.amount, 0.10 ether);

        // Fulfil Alice's order: owner receives Alice's original 0.10 ether
        vm.prank(owner);
        counter.fulfil(orderId);
        assertEq(counter.pending(owner), 0.10 ether);
    }

    function test_WrongPaymentReverts() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Bakery", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_B, "Croissant", 0.02 ether);

        // Underpaying
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Counter.WrongPayment.selector, uint128(0.06 ether)));
        counter.order{value: 0.05 ether}(shopId, ITEM_B, 3);

        // Overpaying
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Counter.WrongPayment.selector, uint128(0.06 ether)));
        counter.order{value: 0.07 ether}(shopId, ITEM_B, 3);
    }

    function test_OwnerCannotOrder() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.01 ether);

        vm.prank(owner);
        vm.expectRevert(Counter.OwnerCannotOrder.selector);
        counter.order{value: 0.01 ether}(shopId, ITEM_A, 1);
    }

    function test_InactiveItemCannotBeOrdered() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        // Non-existent item
        vm.prank(alice);
        vm.expectRevert(Counter.NoSuchItem.selector);
        counter.order{value: 0.01 ether}(shopId, ITEM_A, 1);

        // Deactivated item
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.01 ether);
        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0); // deactivate

        vm.prank(alice);
        vm.expectRevert(Counter.NoSuchItem.selector);
        counter.order{value: 0.01 ether}(shopId, ITEM_A, 1);
    }

    function test_Order_BadQty() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.01 ether);

        // qty = 0
        vm.prank(alice);
        vm.expectRevert(Counter.BadQty.selector);
        counter.order{value: 0}(shopId, ITEM_A, 0);

        // qty = 100 (> 99)
        vm.prank(alice);
        vm.expectRevert(Counter.BadQty.selector);
        counter.order{value: 1 ether}(shopId, ITEM_A, 100);
    }

    // --- Fulfil, Decline, Refund ---

    function test_FulfilCreditsShop() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.1 ether);

        vm.prank(alice);
        uint256 orderId = counter.order{value: 0.1 ether}(shopId, ITEM_A, 1);

        assertEq(counter.pending(owner), 0);

        vm.prank(owner);
        counter.fulfil(orderId);

        Counter.Order memory o = counter.orderOf(orderId);
        assertEq(uint256(o.status), uint256(Counter.Status.Fulfilled));
        assertEq(counter.pending(owner), 0.1 ether);

        // Owner withdraws
        uint256 balBefore = owner.balance;
        vm.prank(owner);
        counter.withdraw();
        assertEq(owner.balance - balBefore, 0.1 ether);
        assertEq(counter.pending(owner), 0);
    }

    function test_DeclineRefundsCustomer() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.1 ether);

        vm.prank(alice);
        uint256 orderId = counter.order{value: 0.1 ether}(shopId, ITEM_A, 1);

        assertEq(counter.pending(alice), 0);

        vm.prank(owner);
        counter.decline(orderId);

        Counter.Order memory o = counter.orderOf(orderId);
        assertEq(uint256(o.status), uint256(Counter.Status.Declined));
        assertEq(counter.pending(alice), 0.1 ether);

        // Alice withdraws
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        counter.withdraw();
        assertEq(alice.balance - balBefore, 0.1 ether);
        assertEq(counter.pending(alice), 0);
    }

    function test_RefundOnlyAfterWindow() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600); // 1 hour window

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.1 ether);

        vm.warp(1000);
        vm.prank(alice);
        uint256 orderId = counter.order{value: 0.1 ether}(shopId, ITEM_A, 1);

        // Attempt refund before window expires (e.g. at 1000 + 3599)
        vm.warp(1000 + 3599);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Counter.TooEarly.selector, uint64(1000 + 3600)));
        counter.refund(orderId);

        // After window expires (e.g. at 1000 + 3600)
        vm.warp(1000 + 3600);
        vm.prank(alice);
        counter.refund(orderId);

        Counter.Order memory o = counter.orderOf(orderId);
        assertEq(uint256(o.status), uint256(Counter.Status.Refunded));
        assertEq(counter.pending(alice), 0.1 ether);
    }

    function test_RefundAndFulfilAreExclusive() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.1 ether);

        vm.warp(1000);
        vm.prank(alice);
        uint256 orderId = counter.order{value: 0.1 ether}(shopId, ITEM_A, 1);

        // 1. If fulfilled, cannot be refunded or declined
        vm.prank(owner);
        counter.fulfil(orderId);

        vm.warp(5000);
        vm.prank(alice);
        vm.expectRevert(Counter.NotPlaced.selector);
        counter.refund(orderId);

        vm.prank(owner);
        vm.expectRevert(Counter.NotPlaced.selector);
        counter.decline(orderId);

        // 2. Second order: if refunded, owner cannot fulfil or decline
        vm.prank(alice);
        uint256 order2 = counter.order{value: 0.1 ether}(shopId, ITEM_A, 1);

        vm.warp(10000);
        vm.prank(alice);
        counter.refund(order2);

        vm.prank(owner);
        vm.expectRevert(Counter.NotPlaced.selector);
        counter.fulfil(order2);

        vm.prank(owner);
        vm.expectRevert(Counter.NotPlaced.selector);
        counter.decline(order2);
    }

    function test_NonCustomerCannotRefund() public {
        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 0.1 ether);

        vm.warp(1000);
        vm.prank(alice);
        uint256 orderId = counter.order{value: 0.1 ether}(shopId, ITEM_A, 1);

        vm.warp(5000);
        // Bob attempts to refund Alice's order
        vm.prank(bob);
        vm.expectRevert(Counter.NotCustomer.selector);
        counter.refund(orderId);
    }

    function test_ReentrantWithdrawBlocked() public {
        MaliciousRecipient attacker = new MaliciousRecipient(counter);
        vm.deal(address(attacker), 10 ether);

        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", 1 ether);

        // Attacker orders an item
        vm.prank(address(attacker));
        uint256 orderId = counter.order{value: 1 ether}(shopId, ITEM_A, 1);

        // Shop declines order, crediting attacker's pending balance
        vm.prank(owner);
        counter.decline(orderId);

        assertEq(counter.pending(address(attacker)), 1 ether);

        // Attacker withdraws, receive() will attempt reentrant withdraw()
        attacker.attack();

        // Check reentrancy reverted with ReentrantCall
        assertEq(attacker.lastRevertData(), abi.encodeWithSelector(Counter.ReentrantCall.selector));
        // Attacker received their 1 ether legitimately, pending is 0
        assertEq(counter.pending(address(attacker)), 0);
    }

    // --- Pagination and Views ---

    function test_PaginationBounds() public {
        vm.startPrank(owner);
        for (uint256 i = 1; i <= 5; i++) {
            counter.openShop("Shop", 3600);
        }
        vm.stopPrank();

        // latestShops
        (Counter.Shop[] memory shops, uint256[] memory ids) = counter.latestShops(0, 3);
        assertEq(shops.length, 3);
        assertEq(ids.length, 3);
        assertEq(ids[0], 5); // newest first
        assertEq(ids[1], 4);
        assertEq(ids[2], 3);

        (shops, ids) = counter.latestShops(3, 5);
        assertEq(shops.length, 2);
        assertEq(ids[0], 2);
        assertEq(ids[1], 1);

        // Out of bounds offset
        (shops, ids) = counter.latestShops(5, 10);
        assertEq(shops.length, 0);

        // Orders pagination
        vm.prank(owner);
        counter.setItem(1, ITEM_A, "Item", 0.01 ether);

        vm.startPrank(alice);
        for (uint256 i = 0; i < 4; i++) {
            counter.order{value: 0.01 ether}(1, ITEM_A, 1);
        }
        vm.stopPrank();

        (Counter.Order[] memory sOrders, uint256[] memory sIds) = counter.ordersByShop(1, 0, 2);
        assertEq(sOrders.length, 2);
        assertEq(sIds[0], 4); // newest first
        assertEq(sIds[1], 3);

        // ordersByShop with offset > 0
        (sOrders, sIds) = counter.ordersByShop(1, 1, 2);
        assertEq(sOrders.length, 2);
        assertEq(sIds[0], 3);
        assertEq(sIds[1], 2);

        // ordersByShop on shopId == shopCount (5)
        (sOrders, sIds) = counter.ordersByShop(5, 0, 10);
        assertEq(sOrders.length, 0);

        (Counter.Order[] memory cOrders, uint256[] memory cIds) = counter.ordersByCustomer(alice, 2, 10);
        assertEq(cOrders.length, 2);
        assertEq(cIds[0], 2);
        assertEq(cIds[1], 1);
    }

    // --- Fuzz Test ---

    function testFuzz_Conservation(
        uint128 unitPrice,
        uint16 qty,
        uint8 outcome
    ) public {
        vm.assume(unitPrice >= 1 wei && unitPrice <= 100 ether);
        qty = uint16(bound(qty, 1, 99));

        uint256 totalCost = uint256(unitPrice) * uint256(qty);
        vm.assume(totalCost <= 100 ether);

        vm.deal(alice, totalCost);

        vm.prank(owner);
        uint256 shopId = counter.openShop("Shop", 3600);

        vm.prank(owner);
        counter.setItem(shopId, ITEM_A, "Item", unitPrice);

        uint256 contractBalBefore = address(counter).balance;

        vm.prank(alice);
        uint256 orderId = counter.order{value: totalCost}(shopId, ITEM_A, qty);

        assertEq(address(counter).balance, contractBalBefore + totalCost);

        uint8 choice = outcome % 3;
        if (choice == 0) {
            // Fulfil
            vm.prank(owner);
            counter.fulfil(orderId);
            assertEq(counter.pending(owner), totalCost);

            vm.prank(owner);
            counter.withdraw();
            assertEq(counter.pending(owner), 0);
        } else if (choice == 1) {
            // Decline
            vm.prank(owner);
            counter.decline(orderId);
            assertEq(counter.pending(alice), totalCost);

            vm.prank(alice);
            counter.withdraw();
            assertEq(counter.pending(alice), 0);
        } else {
            // Refund
            vm.warp(block.timestamp + 3601);
            vm.prank(alice);
            counter.refund(orderId);
            assertEq(counter.pending(alice), totalCost);

            vm.prank(alice);
            counter.withdraw();
            assertEq(counter.pending(alice), 0);
        }

        assertEq(address(counter).balance, contractBalBefore);
    }
}
