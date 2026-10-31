import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

/**
 * Hàm lưu sự kiện người dùng
 * @param url 
 */
export const recorder = {
    browser: null,
    async initBrowser() {
        return puppeteer.launch({
            headless: false,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--start-maximized',
                ...(process.env.PUPPETEER_NO_SANDBOX === 'true' ? ['--no-sandbox'] : []),
            ],
            defaultViewport: null
        });
    },
    async run(url) {
        if (this.browser?.connected) {
            throw new Error('Selector recording is already in progress.');
        }

        let startTimer = performance.now();
        const elementData = [];
        let browser;

        try {
            /**
             * Khởi tạo browser bằng puppeteer
             */
             puppeteer.use(StealthPlugin())

            browser = await this.initBrowser();
            this.browser = browser;
            const browserClosed = new Promise((resolve) => {
                browser.once('disconnected', resolve);
            });

            const page = await browser.newPage();

            let pageOpenTimer = performance.now();
            let pagePfm = ((pageOpenTimer - startTimer)/ 1000).toExponential(4)
            console.log('Browser & page open after %d second...', pagePfm);
    
            /**
             * Tiêm vào window 1 hàm của module recordEvent2
             * dùng để lưu các kết quả là element mà người dùng đã chọn
             */
            await page.exposeFunction('saveEvent', response => {
                console.log(response)
                elementData.push(response)
            });
    
            /**
             * Truyền vào page hàm sự kiện để lưu các hành vi người dùng
             */
            await page.evaluateOnNewDocument(() => {
                // get index for nth of type element
                function getIndex(element) {
                    let ix = 0;
                    let siblings = element.parentNode.childNodes
                    for (var i = 0; i < siblings.length; i++) {
                        var sibling = siblings[i];
                        if (sibling === element)
                            return (ix + 1)
                        if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
                            ix++;
                    }
                    return (ix + 1)
                }
                /**
                 * lấy kết quả CSS của 1 element
                 */
                function getCssTo(context) {
                    console.log(context);
                    
                    let pathSelector = []
                    if (context == 'null') throw 'not an dom reference'
                    while (context.tagName) {
                        // selector path
                        const className = context.className.split(" ").join(".")
                        const idName = context.id
                        const tagName = context.tagName
    
                        if (tagName === 'BODY') pathSelector.push('body')
                        else if (tagName === 'TD' || tagName === 'TR' || tagName === 'TH'){
                            let index  = getIndex(context);

                            pathSelector.push(
                                tagName.toLowerCase() +
                                (className ? `.${className}` : '') +
                                (idName ? `#${idName}` : '') +
                                `:nth-of-type(${index})`
                            )
                        }
                        else {
                            pathSelector.push(
                                tagName.toLowerCase() +
                                (className ? `.${className}` : '') +
                                (idName ? `#${idName}` : '')
                            )
                        }
                        context = context.parentNode
                    }
                    if (pathSelector.length > 4) {
                        pathSelector = pathSelector.slice(0, 4)
                    }
                    pathSelector.reverse()
                    let result = pathSelector.join(' ')
                    return result
                }
                /**
                  * lấy kết quả đường đi XPath của 1 element
                  */
                function getXPathTo(element) {
                    if (element.tagName == 'HTML')
                        return '/HTML[1]';
                    if (element === document.body)
                        return '/HTML[1]/BODY[1]';
    
                    var ix = 0;
                    var siblings = element.parentNode.childNodes;
                    for (var i = 0; i < siblings.length; i++) {
                        var sibling = siblings[i];
                        if (sibling === element)
                            return getXPathTo(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
                        if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
                            ix++;
                    }
                }
    
                /**
                 * Sinh ra selector của element hiện tại
                 * Trả về thẻ tag, tên class, id của đối tượng
                 */
                function generateSelector(event, index) {
                    const target = event.target;
                    let element = {
                        index,
                        metadata: "",
                        tag: target.localName,
                        selectorXPath: getXPathTo(target),
                        selectorCSS: getCssTo(target),
                        eventType: event.type,
                    }
                    return element
                }
    
                /**
                 * @param event
                 *  xử lý sự kiện hover của chuột 
                 *  để hiển thị thẻ tag hiện tại muốn chỉ tới
                 */
                function hoverHandler(event) {
                    if (event.type == "mouseover") {
                        event.target.style.outline = "2px dashed #019160";
                        event.target.title = event.target.nodeName;
                    }
                    else if (event.type == "mouseout" && !event.target.dataset.crawlerSelected) {
                        event.target.style.outline = "none";
                        event.target.removeAttribute('title');
                    }
                }
    
                /**
                 * Truyền hàm sự kiện DOM khi đã load xong page
                 */
                document.addEventListener("DOMContentLoaded", () => {
                    /**
                     * Disabled tất cả button
                     */
                    document.body.querySelectorAll('button').forEach(button => {
                        button.setAttribute('disabled', true)
                    })
                    /**
                     * Disabled tất cả link a href
                     */
                    document.body.querySelectorAll('a').forEach(link => {
                        link.onclick = function () { return false }
                    })
                    /**
                     * Bắt sự kiện click
                     * Lưu lại selector của element
                     */
                    let elementCounter = 0
                    document.body.addEventListener("click", async (event) => {
                        let result = generateSelector(event, ++elementCounter);
                        await window.saveEvent(result);
                        event.target.dataset.crawlerSelected = "true";
                        event.target.style.outline = "2px solid #2ca01c";
                    });
                    /**
                     *  Sự kiện chuột Hover
                     */
                    document.body.onmouseover = document.body.onmouseout = hoverHandler
                })
    
    
            });
            console.log('Go to %d ...', url);
            await page.goto(url);
            await browserClosed;
        } catch (error) {
            if (!browser || browser.connected) {
                throw error;
            }
        } finally {
            let endTimer = performance.now();
            let pfm = ((endTimer - startTimer) / 1000).toExponential(4);
            console.log("Record selector done in %d second!", pfm);
            if (browser?.connected) {
                try {
                    await browser.close();
                } catch (error) {
                    console.error('Unable to close selector recorder browser:', error);
                }
            }
            if (this.browser === browser) {
                this.browser = null;
            }
        }

        return elementData;
    }
}
