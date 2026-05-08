"use strict";
// Pure, decoupled NOP Engine
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateNOPMetrics = calculateNOPMetrics;
// Simulated mathematical engine abstracted from your main codebase
function calculateNOPMetrics(trades, riskLimits = [], initialOpeningPositions = []) {
    // 1. Group all trades by Date, then by Pair
    const tradesByDate = new Map();
    const allPairs = new Set();
    // Add pairs from initial opening positions
    for (const op of initialOpeningPositions) {
        allPairs.add(op.pair);
    }
    // Sort trades chronologically to process days in order
    const sortedTrades = [...trades].sort((a, b) => new Date(a.lockedAt).getTime() - new Date(b.lockedAt).getTime());
    for (const trade of sortedTrades) {
        // Extract just the YYYY-MM-DD from the timestamp
        // Fallback to today's date if lockedAt is somehow undefined
        const safeDate = trade.lockedAt || new Date().toISOString();
        const dateKey = safeDate.split('T')[0];
        allPairs.add(trade.pair);
        if (!tradesByDate.has(dateKey)) {
            tradesByDate.set(dateKey, new Map());
        }
        const dayMap = tradesByDate.get(dateKey);
        if (!dayMap.has(trade.pair)) {
            dayMap.set(trade.pair, []);
        }
        dayMap.get(trade.pair).push(trade);
    }
    // Sort the dates chronologically
    const sortedDates = Array.from(tradesByDate.keys()).sort();
    const multiDayMetrics = {};
    const dailySummary = [];
    // We will track the rolling carry-over state day by day
    let currentOpeningPositions = [...initialOpeningPositions];
    // Process day by day
    for (const date of sortedDates) {
        multiDayMetrics[date] = {};
        const dayTradesMap = tradesByDate.get(date);
        const nextDayOpeningPositions = [];
        let dailyTotalProfit = 0;
        let dailyTradesCount = 0;
        for (const pair of Array.from(allPairs)) {
            const pairTrades = dayTradesMap.get(pair) || [];
            dailyTradesCount += pairTrades.length;
            // Defensive check in case pair is undefined or empty
            const safePair = pair || 'UNKNOWN/UNKNOWN';
            const [base, quote] = safePair.split('/');
            const opening = currentOpeningPositions.find(op => op.pair === pair);
            const buyTrades = pairTrades.filter(t => t.action === 'BUY');
            const sellTrades = pairTrades.filter(t => t.action === 'SELL');
            const baseAvailable = (opening?.carriedOverBuyAmount || 0) + buyTrades.reduce((sum, t) => sum + t.amount, 0);
            const baseObligation = (opening?.carriedOverSellAmount || 0) + sellTrades.reduce((sum, t) => sum + t.amount, 0);
            const amountAvailableForSale = baseAvailable - baseObligation;
            const totalQuoteBuy = (opening?.carriedOverBuyValue || 0) + buyTrades.reduce((sum, t) => sum + (t.amount * t.rate), 0);
            const avgBuyRate = baseAvailable > 0 ? totalQuoteBuy / baseAvailable : 0;
            const totalQuoteSell = (opening?.carriedOverSellValue || 0) + sellTrades.reduce((sum, t) => sum + (t.amount * t.rate), 0);
            const avgSellRate = baseObligation > 0 ? totalQuoteSell / baseObligation : 0;
            // Compute Realized Profit matching the original Excel / Service logic:
            // Gross Revenue is realized on SELL trades using the day's weighted avg buy rate
            let realizedProfit = 0;
            if (avgBuyRate > 0) {
                // Calculate profit on TODAY's sell trades
                realizedProfit = sellTrades.reduce((sum, t) => {
                    // Profit = (Inflow / AvgBuyRate) - AmountBase
                    const rowProfit = (t.inflow / avgBuyRate) - t.amount;
                    return sum + rowProfit;
                }, 0);
            }
            dailyTotalProfit += realizedProfit;
            // --- Risk & Exposure Calculations ---
            const netPosition = amountAvailableForSale;
            let positionType = 'FLAT';
            if (netPosition > 0)
                positionType = 'LONG';
            if (netPosition < 0)
                positionType = 'SHORT';
            let limitUtilizationPercentage = 0;
            let isLimitBreached = false;
            let breachAmount = 0;
            let warning = null;
            const baseLimit = riskLimits.find(l => l.currency === base);
            if (baseLimit) {
                if (positionType === 'LONG') {
                    limitUtilizationPercentage = (netPosition / baseLimit.maxLongExposure) * 100;
                    if (netPosition > baseLimit.maxLongExposure) {
                        isLimitBreached = true;
                        breachAmount = netPosition - baseLimit.maxLongExposure;
                        warning = `CRITICAL: Long exposure limit breached by ${breachAmount.toLocaleString()} ${base}`;
                    }
                }
                else if (positionType === 'SHORT') {
                    const absPosition = Math.abs(netPosition);
                    limitUtilizationPercentage = (absPosition / baseLimit.maxShortExposure) * 100;
                    if (absPosition > baseLimit.maxShortExposure) {
                        isLimitBreached = true;
                        breachAmount = absPosition - baseLimit.maxShortExposure;
                        warning = `CRITICAL: Short exposure limit breached by ${breachAmount.toLocaleString()} ${base}`;
                    }
                }
            }
            multiDayMetrics[date][pair] = {
                pair,
                base,
                quote,
                openBuy: {
                    totalAmount: baseAvailable,
                    averageRate: parseFloat(avgBuyRate.toFixed(4)),
                    totalValue: totalQuoteBuy
                },
                openSell: {
                    totalAmount: baseObligation,
                    averageRate: parseFloat(avgSellRate.toFixed(4)),
                    totalValue: totalQuoteSell
                },
                availability: {
                    amountAvailableForSale,
                    profit: parseFloat(realizedProfit.toFixed(4)) // Explicit daily realized profit
                },
                exposureAndRisk: {
                    netPosition,
                    positionType,
                    limitUtilizationPercentage: parseFloat(limitUtilizationPercentage.toFixed(2)),
                    isLimitBreached,
                    breachAmount,
                    warning
                }
            };
            // Set the carry-over state for the NEXT day based on today's closing Net Position
            if (netPosition > 0) {
                // Positive Net Position carries over as a BUY
                nextDayOpeningPositions.push({
                    pair,
                    carriedOverBuyAmount: netPosition,
                    carriedOverBuyValue: netPosition * avgBuyRate,
                    carriedOverSellAmount: 0,
                    carriedOverSellValue: 0
                });
            }
            else if (netPosition < 0) {
                // Negative Net Position carries over as a SELL
                const absPosition = Math.abs(netPosition);
                nextDayOpeningPositions.push({
                    pair,
                    carriedOverBuyAmount: 0,
                    carriedOverBuyValue: 0,
                    carriedOverSellAmount: absPosition,
                    carriedOverSellValue: absPosition * avgSellRate
                });
            }
        }
        // Roll the state forward to the next day
        currentOpeningPositions = nextDayOpeningPositions;
        dailySummary.push({
            date,
            totalTradesProcessed: dailyTradesCount,
            totalRealizedProfit: parseFloat(dailyTotalProfit.toFixed(4))
        });
    }
    return {
        totalTrades: trades.length,
        dailySummary,
        multiDayMetrics
    };
}
