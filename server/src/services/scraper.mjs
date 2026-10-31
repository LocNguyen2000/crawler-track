import puppeteer from 'puppeteer'
import chromium from '@sparticuz/chromium'
// import puppeteer from 'puppeteer-extra'
// import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const minimal_args = [
    '--window-size=1920,1080',
];

/**
 * Crawl dữ liệu bằng selector được cho
 */
export const scraper = {
    async initBrowser(headless = process.env.PUPPETEER_HEADLESS === 'true') {
        if (process.env.VERCEL) {
            return puppeteer.launch({
                args: chromium.args,
                executablePath: await chromium.executablePath(),
                headless: true,
                defaultViewport: {
                    width: 1920,
                    height: 1080
                }
            })
        }
        return puppeteer.launch({
            headless,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                ...minimal_args,
                ...(process.env.PUPPETEER_NO_SANDBOX === 'true' ? ['--no-sandbox'] : []),
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        })
    },
    async autoScroll(page){
        await page.evaluate(async () => {
            await new Promise((resolve, reject) => {
                var totalHeight = 0;
                var distance = 100;
                var timer = setInterval(() => {
                    var scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
    
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    },

    async run(type, urls, selectors, headless) {
        let startTimer = performance.now()
        let browser;
        try {
            let resultData = []

            /**
             * Khởi tạo browser bằng puppeteer
             */
            browser = await this.initBrowser(headless)

            const page = await browser.newPage();

            await page.setViewport({
                width: 1920,
                height: 1080
            })

            let pageOpenTimer = performance.now();
            let pagePfm = ((pageOpenTimer - startTimer) / 1000).toPrecision(4)
            console.log('Browser & page open after %d', pagePfm);

            switch (type) {
                case 'xpath': {
                    for (let url of urls) {
                        let scrapeStartTimer = performance.now()

                        let resultObject = {}

                        await page.goto(url, { waitUntil: "networkidle2", timeout: 0});

                        await Promise.all(selectors.map(async (slt) => {

                            await page.waitForFunction(
                                (xpath) => document.evaluate(
                                    xpath,
                                    document,
                                    null,
                                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                                    null
                                ).singleNodeValue !== null,
                                { timeout: 30000 },
                                slt.selectorXPath
                            ).catch((err) => {
                                console.log('Fail to find slt');
                            })

                            let text = await page.evaluate(sltObj => {
                                let result = []
                                let dom = document.evaluate(sltObj.selectorXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
                                for (let i = 0; i < dom.snapshotLength; i++) {
                                    let ele = dom.snapshotItem(i)
                                    if (ele) {
                                        if (ele.tagName == 'A') {
                                            result.push(ele.href)
                                        }
                                        else {
                                            result.push(ele.innerText);
                                        }
                                    }
                                }
                                return result;
                            }, slt).catch(err => {
                                console.log('Fail to evaluate');
                            })


                            let meta = slt.metadata === '' ? `field_${slt.index}` : slt.metadata
                            resultObject[meta] = (text != null ? text : '')

                        }))
                        resultData.push(resultObject);

                        let scrapeEndTimer = performance.now()
                        let scrapePfm = ((scrapeEndTimer - scrapeStartTimer) / 1000).toPrecision(4)
                        console.log(`Scrape ${url} after %d second...`, scrapePfm);
                    }

                    console.log('Finish Crawl Data (XPath)...')
                    break
                }

                case 'css': {
                    for (let url of urls) {
                        let scrapeStartTimer = performance.now()

                        let resultObject = {}

                        await page.goto(url, { waitUntil: "networkidle2", timeout: 0  });

                        await Promise.all(selectors.map(async (slt) => {

                            await page.waitForSelector(slt.selectorCSS).catch((err) => {
                                console.log('Fail to find slt');
                            })

                            let text = await page.evaluate(sltObj => {
                                let dom = document.querySelectorAll(sltObj.selectorCSS)
                                let result = []
                               
                                if (!dom){
                                    return result;
                                }

                                for (let i = 0; i < dom.length; i++) {
                                    switch (sltObj.tag) {
                                        case 'a': {
                                            result.push(dom[i].href)
                                            break;
                                        }
                                        default: {
                                            result.push(dom[i].innerText)
                                            break;
                                        }
                                    }
                                }

                                return result
                            }, slt).catch(err => {
                                console.log('Fail to evaluate');
                            })

                            let meta = slt.metadata === '' ? `field_${slt.index}` : slt.metadata

                            resultObject[meta] = (text != null ? text : '')
                        }))
                        resultData.push(resultObject);

                        let scrapeEndTimer = performance.now()
                        let scrapePfm = ((scrapeEndTimer - scrapeStartTimer) / 1000).toPrecision(4)
                        console.log(`Scrape ${url} after %d second...`, scrapePfm);
                    }

                    console.log('Finish Crawl Data (CSS)...')
                    // console.log(resultData)
                    break
                }
            }
            let endTimer = performance.now()
            let pfm = ((endTimer - startTimer) / 1000).toPrecision(4)
            console.log('Crawl data done in %d second.', pfm);

            return { data: resultData, performance: pfm }
        } catch (error) {
            console.error(error);
            throw error
        } finally {
            if (browser?.connected) {
                await browser.close().catch((error) => {
                    console.error('Unable to close crawler browser:', error);
                });
            }
        }
    }
}
