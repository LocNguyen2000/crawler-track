import cron from "node-cron";
import { Crawlers } from "../model/index.mjs";
import { executeCrawler } from "./crawlerRunner.mjs";

const scheduledTasks = new Map();
const scheduleTimezone = "Asia/Ho_Chi_Minh";

export function validateCronExpression(expression) {
    if (expression == null || expression === "") return "";
    if (typeof expression !== "string") {
        throw new Error("Cron schedule must be a five-field expression.");
    }

    const normalized = expression.trim();
    if (!normalized) return "";
    if (normalized.split(/\s+/).length !== 5 || !cron.validate(normalized)) {
        throw new Error("Enter a valid five-field cron expression.");
    }
    return normalized;
}

export function syncCrawlerSchedule(crawlerCode, expression) {
    scheduledTasks.get(crawlerCode)?.stop();
    scheduledTasks.delete(crawlerCode);

    const normalized = validateCronExpression(expression);
    if (!normalized) return;

    const task = cron.schedule(
        normalized,
        async () => {
            console.info(`Starting scheduled crawl for ${crawlerCode}`);
            try {
                await executeCrawler(crawlerCode);
                console.info(`Scheduled crawl completed for ${crawlerCode}`);
            } catch (error) {
                console.error(`Scheduled crawl failed for ${crawlerCode}:`, error);
            }
        },
        { name: crawlerCode, noOverlap: true, timezone: scheduleTimezone },
    );

    scheduledTasks.set(crawlerCode, task);
}

export async function restoreCrawlerSchedules() {
    const crawlers = await Crawlers.find({
        cronExpression: { $type: "string", $ne: "" },
    });

    for (const crawler of crawlers) {
        try {
            syncCrawlerSchedule(crawler.crawlerCode, crawler.cronExpression);
            console.info(
                `Restored schedule for ${crawler.crawlerCode}: ${crawler.cronExpression}`,
            );
        } catch (error) {
            console.error(
                `Unable to restore schedule for ${crawler.crawlerCode}:`,
                error,
            );
        }
    }
}
