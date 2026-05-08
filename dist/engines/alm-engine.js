"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLiquidityForecast = generateLiquidityForecast;
// Simulated forecasting logic decoupled from prisma
function generateLiquidityForecast(data, forecastMonths) {
    const avgRev = data.monthlyRevenue.reduce((a, b) => a + b, 0) / data.periodMonths;
    const avgExp = data.monthlyExpenses.reduce((a, b) => a + b, 0) / data.periodMonths;
    let currentCash = data.currentCash;
    const forecasts = [];
    const alerts = [];
    for (let i = 1; i <= forecastMonths; i++) {
        // Simple linear trend for demo purposes
        const projectedRev = avgRev * (1 + (i * 0.02));
        const projectedExp = avgExp * (1 + (i * 0.015));
        currentCash = currentCash + projectedRev - projectedExp;
        forecasts.push({
            period: `Month +${i}`,
            receivables: projectedRev,
            payables: projectedExp,
            bank_balance_closing: currentCash
        });
        if (currentCash < 0) {
            alerts.push({
                type: 'critical',
                message: `Negative cash balance projected in Month +${i}`,
                impact: Math.abs(currentCash)
            });
        }
    }
    return {
        scenarios: [
            {
                name: "Main Deterministic Scenario",
                forecasts
            }
        ],
        alerts
    };
}
