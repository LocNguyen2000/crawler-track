import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";

import authRouter, { assertAuthCookieConfiguration } from "./routes/auth.routes.mjs";
import crawlerRouter from "./routes/crawler.routes.mjs";
import { requireAuth } from "./middleware/requireAuth.mjs";
import { getCorsOrigins } from "./config/corsOrigins.mjs";
import { connectDatabase } from "./services/database.mjs";
import { assertAuthConfiguration } from "./services/authSecurity.mjs";
import { runDueCrawlerSchedules } from "./services/crawlerScheduler.mjs";

assertAuthConfiguration();
assertAuthCookieConfiguration();

const app = express();
const corsOrigins = getCorsOrigins();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(cookieParser());
app.use(fileUpload());

app.use(async (_req, _res, next) => {
    try {
        await connectDatabase();
        return next();
    } catch (error) {
        console.error("Unable to connect to MongoDB:", error);
        return next(error);
    }
});

app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.get("/cron/crawlers", async (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error("CRON_SECRET is required to run Vercel scheduled crawls.");
        return res.status(503).json({ message: "Scheduled crawl service is not configured." });
    }

    const expectedAuthorization = Buffer.from(`Bearer ${secret}`);
    const authorization = Buffer.from(req.get("authorization") || "");
    if (
        authorization.length !== expectedAuthorization.length
        || !timingSafeEqual(authorization, expectedAuthorization)
    ) {
        return res.status(401).json({ message: "Unauthorized." });
    }

    try {
        const result = await runDueCrawlerSchedules();
        return res.status(200).json(result);
    } catch (error) {
        return next(error);
    }
});

app.use("/auth", authRouter);
app.use("/crawler", requireAuth, crawlerRouter);

app.use((error, _req, res, _next) => {
    console.error("Unhandled API error:", error);
    res.status(500).json({ message: "An unexpected server error occurred." });
});

export default app;
