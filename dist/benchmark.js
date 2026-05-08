"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nop_engine_1 = require("./engines/nop-engine");
const TOTAL_TRADES = 1_000_000;
const DAYS = 30;
console.log(`Generating ${TOTAL_TRADES.toLocaleString()} dummy trades across ${DAYS} days...`);
const trades = [];
const pairs = ['USD/NGN', 'EUR/NGN', 'GBP/NGN', 'USD/KES', 'EUR/USD'];
const actions = ['BUY', 'SELL'];
// Create 30 consecutive days starting from today
const baseDate = new Date();
const dates = [];
for (let i = 0; i < DAYS; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString());
}
for (let i = 0; i < TOTAL_TRADES; i++) {
    trades.push({
        id: `id_${i}`,
        tradeId: `t_${i}`,
        lockedAt: dates[i % DAYS], // Spread evenly across 30 days
        action: actions[i % 2],
        pair: pairs[i % 5],
        amount: Math.random() * 10000,
        rate: 1500 + Math.random() * 100,
        inflow: Math.random() * 10000,
        outflow: Math.random() * 10000
    });
}
console.log(`\nStarting chronological NOP calculation for ${TOTAL_TRADES.toLocaleString()} trades...`);
const startTime = performance.now();
const result = (0, nop_engine_1.calculateNOPMetrics)(trades, [
    { currency: 'USD', maxLongExposure: 500000000, maxShortExposure: 500000000 },
    { currency: 'EUR', maxLongExposure: 200000000, maxShortExposure: 200000000 }
]);
const endTime = performance.now();
const executionTimeMs = endTime - startTime;
console.log('\n--- Benchmark Results ---');
console.log(`Total Trades Processed: ${result.totalTrades.toLocaleString()}`);
console.log(`Unique Days Processed: ${Object.keys(result.multiDayMetrics).length}`);
console.log(`Unique Currency Pairs: 5`);
console.log(`Execution Time: ${(executionTimeMs / 1000).toFixed(2)} seconds`);
console.log(`Speed: ${Math.round(TOTAL_TRADES / (executionTimeMs / 1000)).toLocaleString()} trades per second`);
