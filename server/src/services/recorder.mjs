import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

/**
 * Hàm lưu sự kiện người dùng
 * @param url 
 */
export const recorder = {
    browser: null,
     async initBrowser(){
        try {
            const browser = await puppeteer.launch({
                headless: process.env.PUPPETEER_HEADLESS === 'true',
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--window-size=1920,1080',
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
    async run(url) {
        let startTimer = performance.now();
    
        let elementData = []
        try {
            /**
             * Khởi tạo browser bằng puppeteer
             */
             puppeteer.use(StealthPlugin())

            this.browser = await this.initBrowser();

            const page = await this.browser.newPage();

            await page.setViewport({
                width: 1920,
                height: 1080
            })
            
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
                    let element = {
                        index,
                        metadata: "",
                        tag: event.path[0].localName,
                        selectorXPath: getXPathTo(event.target),
                        selectorCSS: getCssTo(event.target),
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
                    else if (event.type == "mouseout") {
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
                    document.body.addEventListener("click", (event) => {
                        console.log('Extracting Element');
    
                        let result = generateSelector(event, ++elementCounter);
                        console.log(result);
                        window.saveEvent(result);
                        alert('Selector extracted')
                    });
                    /**
                     *  Sự kiện chuột Hover
                     */
                    document.body.onmouseover = document.body.onmouseout = hoverHandler
                })
    
    
            });
            console.log('Go to %d ...', url);
            await page.goto(url)
            await page.waitForNavigation()
                .then(async () => {
                    await this.browser.close()
                })
                .catch((error) => {
                    console.log('Navigation done...')
                })
        } catch (error) {
            await this.browser.close()

            console.log(error.message)
            throw error
        }
        finally {
            let endTimer = performance.now();
    
            let pfm = ((endTimer - startTimer)/ 1000).toExponential(4)
            console.log("Record selector done in %d second!", pfm )
    
            console.log(elementData);
    
            return elementData
        }
    }
} 
