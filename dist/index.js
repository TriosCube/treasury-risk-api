"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const nop_engine_1 = require("./engines/nop-engine");
const alm_engine_1 = require("./engines/alm-engine");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// OpenAPI Specification for generating SDKs
const swaggerDocument = {
    openapi: "3.0.0",
    info: {
        title: "Treasury Risk API (NOP & ALM)",
        version: "1.0.0",
        description: "Standalone API for Net Open Position (NOP) and Asset-Liability Management (ALM) calculations. Connect your trades and ledger data to get risk forecasts.",
    },
    servers: [
        { url: "http://localhost:4000/api/v1", description: "Local Development" },
    ],
    paths: {
        "/nop/exposure": {
            post: {
                summary: "Calculate Net Open Position (NOP) Exposure & Risk",
                description: "Submit an array of raw trades and optional risk limits. Returns structured NOP metrics including explicit Open Buy, Open Sell, Available for Sale, and Profit.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    date: { type: "string", example: "2026-05-07" },
                                    trades: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                id: { type: "string" },
                                                tradeId: { type: "string" },
                                                action: { type: "string", enum: ["BUY", "SELL"] },
                                                pair: { type: "string", example: "USD/NGN" },
                                                amount: { type: "number" },
                                                rate: { type: "number" },
                                                inflow: { type: "number" },
                                                outflow: { type: "number" },
                                            },
                                        },
                                    },
                                    riskLimits: {
                                        type: "array",
                                        description: "Optional limits to check utilization and breaches",
                                        items: {
                                            type: "object",
                                            properties: {
                                                currency: { type: "string", example: "USD" },
                                                maxLongExposure: { type: "number", example: 1000000 },
                                                maxShortExposure: { type: "number", example: 500000 },
                                            },
                                        },
                                    },
                                    openingPositions: {
                                        type: "array",
                                        description: "Optional carried-over positions from the previous period (e.g. yesterday closing balance)",
                                        items: {
                                            type: "object",
                                            properties: {
                                                pair: { type: "string", example: "USD/NGN" },
                                                carriedOverBuyAmount: { type: "number", example: 5000 },
                                                carriedOverBuyValue: {
                                                    type: "number",
                                                    example: 7500000,
                                                },
                                                carriedOverSellAmount: {
                                                    type: "number",
                                                    example: 2000,
                                                },
                                                carriedOverSellValue: {
                                                    type: "number",
                                                    example: 3100000,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            example: {
                                trades: [
                                    {
                                        id: "1",
                                        tradeId: "t1",
                                        lockedAt: "2026-05-07T10:00:00Z",
                                        action: "BUY",
                                        pair: "USD/NGN",
                                        amount: 10000,
                                        rate: 1500,
                                        inflow: 10000,
                                        outflow: 15000000
                                    },
                                    {
                                        id: "2",
                                        tradeId: "t2",
                                        lockedAt: "2026-05-08T14:00:00Z",
                                        action: "SELL",
                                        pair: "USD/NGN",
                                        amount: 8000,
                                        rate: 1550,
                                        inflow: 12400000,
                                        outflow: 8000
                                    },
                                    {
                                        id: "3",
                                        tradeId: "t3",
                                        lockedAt: "2026-05-08T15:00:00Z",
                                        action: "BUY",
                                        pair: "EUR/NGN",
                                        amount: 5000,
                                        rate: 1650,
                                        inflow: 5000,
                                        outflow: 8250000
                                    }
                                ],
                                riskLimits: [
                                    { currency: "USD", maxLongExposure: 1000000, maxShortExposure: 500000 },
                                    { currency: "EUR", maxLongExposure: 500000, maxShortExposure: 250000 }
                                ],
                                openingPositions: [
                                    {
                                        pair: "USD/NGN",
                                        carriedOverBuyAmount: 5000,
                                        carriedOverBuyValue: 7500000,
                                        carriedOverSellAmount: 2000,
                                        carriedOverSellValue: 3100000
                                    },
                                    {
                                        pair: "EUR/NGN",
                                        carriedOverBuyAmount: 0,
                                        carriedOverBuyValue: 0,
                                        carriedOverSellAmount: 1000,
                                        carriedOverSellValue: 1600000
                                    }
                                ]
                            }
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Successful NOP calculation returning explicit buy/sell, daily summary, and availability data",
                    },
                },
            },
        },
        "/alm/forecast": {
            post: {
                summary: "Generate ALM Liquidity Forecast",
                description: "Submit historical ledger and trade aggregations. Returns predictive cash flow scenarios and alerts.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    forecastMonths: { type: "number", example: 12 },
                                    data: {
                                        type: "object",
                                        properties: {
                                            monthlyRevenue: {
                                                type: "array",
                                                items: { type: "number" },
                                            },
                                            monthlyExpenses: {
                                                type: "array",
                                                items: { type: "number" },
                                            },
                                            currentCash: { type: "number" },
                                            periodMonths: { type: "number" },
                                        },
                                    },
                                },
                            },
                            example: {
                                forecastMonths: 12,
                                data: {
                                    monthlyRevenue: [150000, 160000, 175000],
                                    monthlyExpenses: [100000, 105000, 110000],
                                    currentCash: 500000,
                                    periodMonths: 3
                                }
                            }
                        },
                    },
                },
                responses: {
                    "200": { description: "Successful ALM forecasting" },
                },
            },
        },
    },
};
// Mount Swagger UI
app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
// API Routes
const apiRouter = express_1.default.Router();
app.get("/", (req, res) => {
    res.redirect("/docs");
});
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "treasury-risk-api" });
});
apiRouter.post("/nop/exposure", (req, res) => {
    const { trades, riskLimits, openingPositions } = req.body;
    if (!trades || !Array.isArray(trades)) {
        return res.status(400).json({ error: "Invalid trades payload" });
    }
    const result = (0, nop_engine_1.calculateNOPMetrics)(trades, riskLimits || [], openingPositions || []);
    res.json(result);
});
apiRouter.post("/alm/forecast", (req, res) => {
    const { data, forecastMonths } = req.body;
    if (!data) {
        return res.status(400).json({ error: "Invalid ALM payload" });
    }
    const result = (0, alm_engine_1.generateLiquidityForecast)(data, forecastMonths || 12);
    res.json(result);
});
app.use("/api/v1", apiRouter);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Treasury Risk API is running on http://localhost:${PORT}`);
    console.log(`📚 Swagger Docs (for SDK generation): http://localhost:${PORT}/docs`);
});
