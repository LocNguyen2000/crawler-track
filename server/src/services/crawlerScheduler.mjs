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
    if (normalized.split(/\s+/).length !== 5 || !cron.validate(normalized)) {
        throw new Error("Enter a valid five-field cron expression.");
    }
    return normalized;
}

export function matchesScheduleAt(expression, date) {
    const task = cron.createTask(expression, () => {}, { timezone: scheduleTimezone });
    return task.match(date);
}

export function syncCrawlerSchedule(crawlerCode, expression) {
    scheduledTasks.get(crawlerCode)?.stop();
    scheduledTasks.delete(crawlerCode);

    const normalized = validateCronExpression(expression);
    if (!normalized || process.env.VERCEL) return;

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

export async function runDueCrawlerSchedules(now = new Date()) {
    const scheduledMinute = new Date(now);
    scheduledMinute.setUTCSeconds(0, 0);

    const crawlers = await Crawlers.find({
        cronExpression: { $type: "string", $ne: "" },
    }).sort({ crawlerCode: 1 });
    const result = { checked: crawlers.length, started: 0, failed: 0 };

    for (const crawler of crawlers) {
        let isDue;
        try {
            isDue = matchesScheduleAt(crawler.cronExpression, scheduledMinute);
        } catch (error) {
            result.failed++;
            console.error(
                `Unable to evaluate schedule for ${crawler.crawlerCode}:`,
                error,
            );
            continue;
        }
        if (!isDue) continue;

        const claimedCrawler = await Crawlers.findOneAndUpdate(
            {
                _id: crawler._id,
                cronExpression: crawler.cronExpression,
                $or: [
                    { lastScheduledRunAt: { $lt: scheduledMinute } },
                    { lastScheduledRunAt: { $exists: false } },
                    { lastScheduledRunAt: null },
                ],
            },
            { $set: { lastScheduledRunAt: scheduledMinute } },
            { new: true },
        );
        if (!claimedCrawler) continue;

        result.started++;
        try {
            const rows = await executeCrawler(crawler.crawlerCode);
            const newRows = getNewRows(rows);
            if (newRows.length > 0) {
                await sendNewDataNotification(crawler.crawlerCode, newRows);
            }
            console.info(`Scheduled crawl completed for ${crawler.crawlerCode}`);
        } catch (error) {
            result.failed++;
            console.error(
                `Scheduled crawl failed for ${crawler.crawlerCode}:`,
                error,
            );
        }
    }

    return result;
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
