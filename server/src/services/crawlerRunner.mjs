import { Crawlers, Selectors, Data } from "../model/index.mjs";
import { scraper } from "./scraper.mjs";
import { processOutput } from "../utils/tools.mjs";
import { markNewRows } from "./dataChanges.mjs";

const activeCrawlers = new Set();

export class CrawlerRunError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

export async function executeCrawler(crawlerCode) {
    if (activeCrawlers.has(crawlerCode)) {
        throw new CrawlerRunError("This crawler is already running.", 409);
    }

    activeCrawlers.add(crawlerCode);
    try {
        const crawler = await Crawlers.findOne({ crawlerCode });
        if (!crawler) {
            throw new CrawlerRunError("Crawler must be saved before crawling data", 404);
        }

        const selectors = await Selectors.find({ crawlerCode });
        if (selectors.length === 0) {
            throw new CrawlerRunError("Selectors must be extracted before crawling data", 404);
        }
        const selectorField = crawler.selectorType === "xpath"
            ? "selectorXPath"
            : "selectorCSS";
        if (!selectors.some((selector) =>
            typeof selector[selectorField] === "string"
            && selector[selectorField].trim(),
        )) {
            throw new CrawlerRunError("Valid selectors must be extracted before crawling data", 404);
        }

        const previousData = await Data.findOne({ crawlerCode });
        const output = await scraper.run(
            crawler.selectorType,
            crawler.urls,
            selectors,
            crawler.headless,
        );
        const result = markNewRows(
            previousData?.data || [],
            processOutput(output.data),
        );

        await Crawlers.findOneAndUpdate(
            { crawlerCode },
            { performance: output.performance },
        );

        await Data.findOneAndUpdate(
            { crawlerCode },
            {
                crawlerCode,
                data: result,
                modifiedDate: new Date(),
            },
            { upsert: true, runValidators: true },
        );

        return result;
    } finally {
        activeCrawlers.delete(crawlerCode);
    }
}
