// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Counter
 * @notice A decentralized point-of-sale contract.
 * Shopkeepers set price lists (up to 32 items) and refund windows (1 hour to 30 days).
 * Customers place orders by paying upfront in BOT.
 * Shopkeepers can fulfil (crediting shop) or decline (refunding customer).
 * If unfilled past the refund deadline, customers claim an instant refund.
 */
contract Counter {
    // --- Constants ---
    uint256 public constant MAX_NAME_BYTES = 40;
    uint32 public constant MIN_REFUND_WINDOW = 3600;      // 1 hour
    uint32 public constant MAX_REFUND_WINDOW = 2592000;   // 30 days
    uint8 public constant MAX_ITEMS_PER_SHOP = 32;
    uint256 public constant MAX_LABEL_BYTES = 32;
    uint16 public constant MIN_QTY = 1;
    uint16 public constant MAX_QTY = 99;
    uint256 public constant MAX_BATCH_VIEW = 50;

    // --- Enums and Structs ---
    enum Status {
        Placed,
        Fulfilled,
        Declined,
        Refunded
    }

    struct Shop {
        address owner;
        uint32 refundAfter;
        uint8 itemCount;
        string name;
    }

    struct Item {
        uint128 price;
        bool active;
        bytes16 code;
        string label;
    }

    struct Order {
        uint256 shopId;
        address customer;
        uint128 amount;
        uint64 placedAt;
        bytes16 item;
        uint16 qty;
        Status status;
    }

    // --- Custom Errors ---
    error NameTooLong();
    error EmptyName();
    error BadRefundWindow();
    error NoSuchShop();
    error TooManyItems();
    error EmptyCode();
    error LabelTooLong();
    error NotOwner();
    error NoSuchItem();
    error BadQty();
    error OwnerCannotOrder();
    error WrongPayment(uint128 expected);
    error NoSuchOrder();
    error NotPlaced();
    error NotCustomer();
    error TooEarly(uint64 readyAt);
    error NothingToWithdraw();
    error TransferFailed();
    error ReentrantCall();

    // --- Events ---
    event ShopOpened(
        uint256 indexed shopId,
        address indexed owner,
        string name,
        uint32 refundAfter
    );

    event ItemSet(
        uint256 indexed shopId,
        bytes16 indexed code,
        string label,
        uint128 price
    );

    event Ordered(
        uint256 indexed orderId,
        uint256 indexed shopId,
        address indexed customer,
        bytes16 item,
        uint16 qty,
        uint128 amount
    );

    event Fulfilled(uint256 indexed orderId);
    event Declined(uint256 indexed orderId);
    event Refunded(uint256 indexed orderId);
    event Withdrawn(address indexed who, uint256 amount);

    // --- Storage ---
    mapping(uint256 => Shop) private _shops;
    mapping(uint256 => mapping(bytes16 => Item)) private _items;
    mapping(uint256 => bytes16[]) private _codes;
    mapping(uint256 => Order) private _orders;
    mapping(uint256 => uint256[]) private _shopOrders;
    mapping(address => uint256[]) private _customerOrders;

    mapping(address => uint256) public pending;
    uint256 public shopCount;
    uint256 public orderCount;

    // --- Reentrancy Guard ---
    uint256 private _locked = 1;

    modifier nonReentrant() {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
        _;
        _locked = 1;
    }

    // --- Core Functions ---

    /**
     * @notice Open a new shop with a name and refund window.
     * @param name Shop name (<= 40 bytes)
     * @param refundAfter Refund deadline window in seconds (1 hour to 30 days)
     */
    function openShop(string calldata name, uint32 refundAfter)
        external
        returns (uint256 id)
    {
        uint256 nameLen = bytes(name).length;
        if (nameLen == 0) revert EmptyName();
        if (nameLen > MAX_NAME_BYTES) revert NameTooLong();
        if (
            refundAfter < MIN_REFUND_WINDOW ||
            refundAfter > MAX_REFUND_WINDOW
        ) {
            revert BadRefundWindow();
        }

        shopCount++;
        id = shopCount;

        _shops[id] = Shop({
            owner: msg.sender,
            refundAfter: refundAfter,
            itemCount: 0,
            name: name
        });

        emit ShopOpened(id, msg.sender, name, refundAfter);
    }

    /**
     * @notice Configure or update an item on the shop's shelf.
     * Setting price to 0 deactivates the item.
     * @param shopId The shop ID
     * @param code Short 16-byte code identifying the item
     * @param label Readable label (<= 32 bytes)
     * @param price Unit price in BOT (0 to deactivate)
     */
    function setItem(
        uint256 shopId,
        bytes16 code,
        string calldata label,
        uint128 price
    ) external {
        if (shopId == 0 || shopId > shopCount) revert NoSuchShop();
        Shop storage s = _shops[shopId];
        if (msg.sender != s.owner) revert NotOwner();
        if (code == bytes16(0)) revert EmptyCode();
        if (bytes(label).length > MAX_LABEL_BYTES) revert LabelTooLong();

        Item storage it = _items[shopId][code];
        bool isNew = (it.code == bytes16(0));

        if (isNew) {
            if (s.itemCount >= MAX_ITEMS_PER_SHOP) revert TooManyItems();
            _codes[shopId].push(code);
            s.itemCount++;
        }

        if (price == 0) {
            it.active = false;
            it.price = 0;
            it.code = code;
            it.label = label;
        } else {
            it.active = true;
            it.price = price;
            it.code = code;
            it.label = label;
        }

        emit ItemSet(shopId, code, label, price);
    }

    /**
     * @notice Place an order for an active item with a specified quantity.
     * @param shopId The shop ID
     * @param item The item code
     * @param qty Number of units (1..99)
     */
    function order(
        uint256 shopId,
        bytes16 item,
        uint16 qty
    ) external payable returns (uint256 orderId) {
        if (shopId == 0 || shopId > shopCount) revert NoSuchShop();
        Shop storage s = _shops[shopId];
        if (msg.sender == s.owner) revert OwnerCannotOrder();

        Item storage it = _items[shopId][item];
        if (!it.active) revert NoSuchItem();
        if (qty < MIN_QTY || qty > MAX_QTY) revert BadQty();

        uint128 expected = it.price * uint128(qty);
        if (msg.value != expected) revert WrongPayment(expected);

        orderCount++;
        orderId = orderCount;

        _orders[orderId] = Order({
            shopId: shopId,
            customer: msg.sender,
            amount: expected,
            placedAt: uint64(block.timestamp),
            item: item,
            qty: qty,
            status: Status.Placed
        });

        _shopOrders[shopId].push(orderId);
        _customerOrders[msg.sender].push(orderId);

        emit Ordered(orderId, shopId, msg.sender, item, qty, expected);
    }

    /**
     * @notice Shop owner marks an order as fulfilled, releasing payment to the shop's pending balance.
     * @param orderId The order ID
     */
    function fulfil(uint256 orderId) external {
        if (orderId == 0 || orderId > orderCount) revert NoSuchOrder();
        Order storage o = _orders[orderId];
        if (o.status != Status.Placed) revert NotPlaced();

        Shop storage s = _shops[o.shopId];
        if (msg.sender != s.owner) revert NotOwner();

        o.status = Status.Fulfilled;
        pending[s.owner] += o.amount;

        emit Fulfilled(orderId);
    }

    /**
     * @notice Shop owner declines an order, returning payment to customer's pending balance immediately.
     * @param orderId The order ID
     */
    function decline(uint256 orderId) external {
        if (orderId == 0 || orderId > orderCount) revert NoSuchOrder();
        Order storage o = _orders[orderId];
        if (o.status != Status.Placed) revert NotPlaced();

        Shop storage s = _shops[o.shopId];
        if (msg.sender != s.owner) revert NotOwner();

        o.status = Status.Declined;
        pending[o.customer] += o.amount;

        emit Declined(orderId);
    }

    /**
     * @notice Customer claims an automatic refund if the order has not been fulfilled within the refund window.
     * @param orderId The order ID
     */
    function refund(uint256 orderId) external {
        if (orderId == 0 || orderId > orderCount) revert NoSuchOrder();
        Order storage o = _orders[orderId];
        if (o.status != Status.Placed) revert NotPlaced();
        if (msg.sender != o.customer) revert NotCustomer();

        Shop storage s = _shops[o.shopId];
        uint64 readyAt = o.placedAt + s.refundAfter;
        if (block.timestamp < readyAt) revert TooEarly(readyAt);

        o.status = Status.Refunded;
        pending[o.customer] += o.amount;

        emit Refunded(orderId);
    }

    /**
     * @notice Pull payment withdrawal for earned revenues or refunded payments.
     */
    function withdraw() external nonReentrant {
        uint256 bal = pending[msg.sender];
        if (bal == 0) revert NothingToWithdraw();

        pending[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: bal}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, bal);
    }

    // --- View Functions ---

    function shopOf(uint256 shopId) external view returns (Shop memory) {
        if (shopId == 0 || shopId > shopCount) revert NoSuchShop();
        return _shops[shopId];
    }

    function itemsOf(uint256 shopId) external view returns (Item[] memory) {
        if (shopId == 0 || shopId > shopCount) revert NoSuchShop();
        bytes16[] storage codes = _codes[shopId];
        uint256 len = codes.length;
        Item[] memory items = new Item[](len);

        for (uint256 i = 0; i < len; i++) {
            items[i] = _items[shopId][codes[i]];
        }
        return items;
    }

    function orderOf(uint256 orderId) external view returns (Order memory) {
        if (orderId == 0 || orderId > orderCount) revert NoSuchOrder();
        return _orders[orderId];
    }

    function ordersByShop(
        uint256 shopId,
        uint256 offset,
        uint256 count
    ) external view returns (Order[] memory orders, uint256[] memory ids) {
        if (shopId == 0 || shopId > shopCount) revert NoSuchShop();
        if (count > MAX_BATCH_VIEW) count = MAX_BATCH_VIEW;

        uint256 total = _shopOrders[shopId].length;
        if (total == 0 || offset >= total) {
            return (new Order[](0), new uint256[](0));
        }

        uint256 maxAvailable = total - offset;
        uint256 n = count < maxAvailable ? count : maxAvailable;

        orders = new Order[](n);
        ids = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            // Newest first
            uint256 currentId = _shopOrders[shopId][total - 1 - offset - i];
            ids[i] = currentId;
            orders[i] = _orders[currentId];
        }
    }

    function ordersByCustomer(
        address customer,
        uint256 offset,
        uint256 count
    ) external view returns (Order[] memory orders, uint256[] memory ids) {
        if (count > MAX_BATCH_VIEW) count = MAX_BATCH_VIEW;

        uint256 total = _customerOrders[customer].length;
        if (total == 0 || offset >= total) {
            return (new Order[](0), new uint256[](0));
        }

        uint256 maxAvailable = total - offset;
        uint256 n = count < maxAvailable ? count : maxAvailable;

        orders = new Order[](n);
        ids = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            // Newest first
            uint256 currentId = _customerOrders[customer][total - 1 - offset - i];
            ids[i] = currentId;
            orders[i] = _orders[currentId];
        }
    }

    function latestShops(uint256 offset, uint256 count)
        external
        view
        returns (Shop[] memory shops, uint256[] memory ids)
    {
        if (count > MAX_BATCH_VIEW) count = MAX_BATCH_VIEW;
        if (shopCount == 0 || offset >= shopCount) {
            return (new Shop[](0), new uint256[](0));
        }

        uint256 maxAvailable = shopCount - offset;
        uint256 n = count < maxAvailable ? count : maxAvailable;

        shops = new Shop[](n);
        ids = new uint256[](n);

        for (uint256 i = 0; i < n; i++) {
            // Newest first
            uint256 currentId = shopCount - offset - i;
            ids[i] = currentId;
            shops[i] = _shops[currentId];
        }
    }
}
