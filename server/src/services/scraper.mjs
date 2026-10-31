import puppeteer from 'puppeteer'
// import puppeteer from 'puppeteer-extra'
// import StealthPlugin from 'puppeteer-extra-plugin-stealth'

const minimal_args = [
    '--window-size=1920,1080',
];

/**
 * Crawl dữ liệu bằng selector được cho
 */
export const scraper = {
    browser: null,
    async initBrowser() {
        try {
            // puppeteer.use(StealthPlugin())

            const browser = await puppeteer.launch({
                headless: process.env.PUPPETEER_HEADLESS === 'true',
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
            return browser;
        } catch (error) {
            console.log('Error when open browser');
        }
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

    async run(type, urls, selectors) {
        let startTimer = performance.now()
        try {
            let resultData = []

            /**
             * Khởi tạo browser bằng puppeteer
             */
            this.browser = await this.initBrowser()

            const page = await this.browser.newPage();

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

                        selectors.map(async (slt) => {

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

                        })
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

                        selectors.map(async (slt) => {

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
                        })
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

            await this.browser.close()

            return { data: resultData, performance: pfm }
        } catch (error) {
            console.log(error.message)
            await this.browser.close()
            throw error
        }
    }
}
