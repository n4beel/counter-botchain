/**
 * Contract limits for Counter.
 * Kept strictly in sync with contracts/src/Counter.sol.
 */
export const MAX_NAME_BYTES = 40;
export const MIN_REFUND_WINDOW = 3600;      // 1 hour in seconds
export const MAX_REFUND_WINDOW = 2592000;   // 30 days in seconds
export const MAX_ITEMS_PER_SHOP = 32;
export const MAX_LABEL_BYTES = 32;
export const MIN_QTY = 1;
export const MAX_QTY = 99;
export const MAX_BATCH_VIEW = 50;
