import cron from "node-cron";
import { Crawlers } from "../model/index.mjs";
import { Users } from "../model/auth.mjs";
import { sendNewDataNotificationEmail } from "./authMail.mjs";
import { executeCrawler } from "./crawlerRunner.mjs";
import { getNewRows } from "./dataChanges.mjs";

const scheduledTasks = new Map();
const scheduleTimezone = "Asia/Ho_Chi_Minh";

export function validateCronExpression(expression) {
    if (expression == null || expression === "") return "";
    if (typeof expression !== "string") {
        throw new Error("Cron schedule must be a five-field expression.");
    }

    const normalized = expression.trim();
    if (!normalized) return "";
    if (process.env.VERCEL) {
        throw new Error("Scheduled crawls are unavailable on Vercel serverless deployments.");
    }
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
                await Crawlers.updateOne(
                    { crawlerCode },
                    { $set: { lastScheduledRunAt: new Date() } },
                );
                const result = await executeCrawler(crawlerCode);
                const newRows = getNewRows(result);
                if (newRows.length > 0) {
                    await sendNewDataNotification(crawlerCode, newRows);
                }
                console.info(`Scheduled crawl completed for ${crawlerCode}`);
            } catch (error) {
                console.error(`Scheduled crawl failed for ${crawlerCode}:`, error);
            }
        },
        { name: crawlerCode, noOverlap: true, timezone: scheduleTimezone },
    );

    scheduledTasks.set(crawlerCode, task);
}

async function sendNewDataNotification(crawlerCode, newRows) {
    try {
        const crawler = await Crawlers.findOne({ crawlerCode })
            .select("crawlerName +ownerUserId");
        if (!crawler?.ownerUserId) {
            console.warn(
                `New data found for ${crawlerCode}, but no crawler owner is set; edit the crawler to enable email notifications.`,
            );
            return;
        }

        const owner = await Users.findOne({
            _id: crawler.ownerUserId,
            emailVerified: true,
        }).select("email");
        if (!owner?.email) {
            console.warn(
                `New data found for ${crawlerCode}, but its verified owner account was not found.`,
            );
            return;
        }

        await sendNewDataNotificationEmail(owner.email, {
            crawlerName: crawler.crawlerName,
            crawlerCode,
            newRows,
        });
        console.info(
            `Sent new-data notification for ${crawlerCode} to its owner.`,
        );
    } catch (error) {
        console.error(
            `Unable to send new-data notification for ${crawlerCode}:`,
            error,
        );
    }
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
