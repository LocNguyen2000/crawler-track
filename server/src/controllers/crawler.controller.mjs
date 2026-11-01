import { Crawlers, Selectors, Data } from "../model/index.mjs";
import { executeCrawler } from "../services/crawlerRunner.mjs";
import { syncCrawlerSchedule, validateCronExpression } from "../services/crawlerScheduler.mjs";
import { generateCrawlerCode } from "../utils/tools.mjs";
import { getCrawlerStatus } from "../services/dataChanges.mjs";

function hasUsableSelector(crawler, selectors) {
    const selectorField = crawler.selectorType === "xpath"
        ? "selectorXPath"
        : "selectorCSS";
    return Array.isArray(selectors)
        && selectors.some((selector) =>
            typeof selector?.[selectorField] === "string"
            && selector[selectorField].trim(),
        );
}

export const generateNewCrawlerCode = async (req, res) => {
    try {
        const crawlerData = await Crawlers.find()

        const newCode = generateCrawlerCode(crawlerData)

        console.log(newCode);

        return res.status(200).json(newCode)
    } catch (error) {
        console.log(error);
        return res.status(500).json("Lỗi của Server. Xin liên hệ dev để xử lý vấn đề này")

    }
}

export const getAllCrawlers = async (req, res) => {
    try {
        let TotalUrls = 0, TotalDataAmount = 0, totalPfmTime = 0, AveragePfmTime;
        let counter = 0;
        
        const crawlersInDB = await Crawlers.find({ ownerUserId: req.user._id })
        
        if (crawlersInDB.length < 0) return res.status(200).json([])
        
        const crawlerCodes = crawlersInDB.map(({ crawlerCode }) => crawlerCode)
        const outputsInDB = await Data.find({ crawlerCode: { $in: crawlerCodes } })

        crawlersInDB.map(crawler => {
            if (crawler.urls){
                TotalUrls += crawler.urls.length
            }
            if (crawler.performance){
                totalPfmTime += parseFloat(crawler.performance); 
                counter++
            }
        })

        AveragePfmTime = (totalPfmTime / counter).toPrecision(4);

        outputsInDB.map(output => {
            if (output.data){
                TotalDataAmount += output.data.length;
            }
        })

        const outputByCrawler = new Map(
            outputsInDB.map((output) => [output.crawlerCode, output.data]),
        );
        const crawlersWithStatus = crawlersInDB.map((crawler) => ({
            ...crawler.toObject(),
            status: getCrawlerStatus(outputByCrawler.get(crawler.crawlerCode)),
        }));

        return res.status(200).json({
            Data: crawlersWithStatus,
            TotalUrls,
            TotalDataAmount,
            AveragePfmTime,
        })
    } catch (error) {
        console.error(error);
        return res.status(500).json("Lỗi của Server. Xin liên hệ dev để xử lý vấn đề này")
    }
}
export const getCrawlerByCode = async (req, res) => {
    try {
        const { crawlerCode } = req.params;

        const crawlerData = await Crawlers.findOne({
            crawlerCode,
            ownerUserId: req.user._id,
        })
        if (!crawlerData) return res.status(404).json("Không tồn tại Crawler")

        const selectorsData = await Selectors.find({ crawlerCode })
        const outputsData = await Data.findOne({ crawlerCode })

        let result = {
            crawler: crawlerData,
            selectors: selectorsData,
            outputs: (outputsData != null) ? outputsData.data : []
        }

        return res.status(200).json(result)
    } catch (error) {
        console.error(error);
        return res.status(500).json("Lỗi của Server. Xin liên hệ dev để xử lý vấn đề này")
    }
}
export const deleteCrawler = async (req, res) => {
    try {
        const { crawlerCode } = req.params

        if (!crawlerCode) {
            return res.status(404).json('Trường thông tin gửi không được để trống')
        }

        const crawlerData = await Crawlers.findOne({
            crawlerCode,
            ownerUserId: req.user._id,
        })

        if (!crawlerData) {
            return res.status(404).json('Crawler không tồn tại')
        }

        await Crawlers.deleteOne({ crawlerCode, ownerUserId: req.user._id })
        await Selectors.deleteMany({ crawlerCode })
        await Data.deleteOne({ crawlerCode })
        syncCrawlerSchedule(crawlerCode, "")

        return res.status(200).json("Đã xóa thành công")
    } catch (error) {
        console.error(error);
        return res.status(404).json(`Request có vấn đề: ${error.message}`)
    }
}

export const clearCrawlerOutputs = async (req, res) => {
    try {
        const { crawlerCode } = req.params;
        const crawler = await Crawlers.findOne({
            crawlerCode,
            ownerUserId: req.user._id,
        });
        if (!crawler) {
            return res.status(404).json("Crawler does not exist.");
        }

        await Data.deleteOne({ crawlerCode });
        return res.status(200).json({ message: "Crawler outputs cleared." });
    } catch (error) {
        console.error(error);
        return res.status(500).json("Unable to clear crawler outputs.");
    }
};

// Tạo mới 2 dữ liệu crawler và element
export const addCrawler = async (req, res) => {
    try {
        let { crawler, selectors = [] } = req.body

        if (!crawler || typeof crawler !== "object") {
            return res.status(400).json("Crawler details are required.")
        }

        let cronExpression
        try {
            cronExpression = validateCronExpression(crawler.cronExpression)
        } catch (error) {
            return res.status(400).json(error.message)
        }

        if (cronExpression && !hasUsableSelector(crawler, selectors)) {
            return res.status(400).json(
                "Add at least one valid selector before enabling a crawl schedule.",
            )
        }

        // validate dữ liệu 
        const crawlerData = await Crawlers.findOne({ crawlerCode: crawler.crawlerCode })

        if (crawlerData) return res.status(400).json("Crawler đã tồn tại")
        else {
            // đủ thì tạo mới dữ liệu
            crawler.modifiedDate = new Date()
            crawler.cronExpression = cronExpression

            const newCrawler = new Crawlers({
                ...crawler,
                ownerUserId: req.user._id,
            })
            await newCrawler.save()

            // tạo mới nhiều selectors
            await Promise.all(selectors.map((selector) => new Selectors({
                ...selector,
                crawlerCode: crawler.crawlerCode,
                modifiedDate: new Date(),
            }).save()))
            syncCrawlerSchedule(crawler.crawlerCode, cronExpression)
        }
        return res.status(201).json("Tạo mới Crawler thành công")
    } catch (error) {
        console.error(error);
        return res.status(400).json(`Lỗi tạo mới Crawerl: ${error.message}`)
    }
}


// Cập nhật theo 2 dữ liệu crawler và selector
export const updateCrawler = async (req, res) => {
    try {
        const { crawlerCode } = req.params
        let { crawler, selectors } = req.body

        if (!crawler) {
            return res.status(404).json('Trường thông tin còn thiếu')
        }

        // kiểm tra crawler tồn tại
        let crawlerData = await Crawlers.findOne({
            crawlerCode,
            ownerUserId: req.user._id,
        }).select("+ownerUserId")
        if (!crawlerData) {
            return res.status(404).json('Không tồn tại crawler')
        }

        let cronExpression
        try {
            cronExpression = validateCronExpression(
                crawler.cronExpression ?? crawlerData.cronExpression,
            )
        } catch (error) {
            return res.status(400).json(error.message)
        }

        const selectorsToSave = Array.isArray(selectors)
            ? selectors
            : await Selectors.find({ crawlerCode })
        const crawlerToSave = { ...crawler }
        delete crawlerToSave.ownerUserId
        crawlerToSave.cronExpression = cronExpression

        if (cronExpression && !hasUsableSelector(crawlerToSave, selectorsToSave)) {
            return res.status(400).json(
                "Add at least one valid selector before enabling a crawl schedule.",
            )
        }

        // kiểm tra mã crawler cập nhật có tồn tại 
        if (crawlerToSave.crawlerCode && crawlerCode != crawlerData.crawlerCode){
            crawlerData = await Crawlers.findOne({ crawlerCode: crawlerToSave.crawlerCode })
            if (crawlerData){
                return res.status(404).json('Mã crawler cập nhật đã tồn tại')
            }
        }
            
        crawlerToSave.modifiedDate = new Date()
        
        // cập nhật dựa trên tên của crawler
        await Crawlers.updateOne({
            crawlerCode,
            ownerUserId: req.user._id,
        }, crawlerToSave)
        
        // cập nhật nhiều selectors (xóa hết r tạo lại)      
        if (Array.isArray(selectors)) {
            await Selectors.deleteMany({ crawlerCode: crawlerCode })

            // tạo mới nhiều selectors
            await Promise.all(selectors.map((selector) => new Selectors({
                ...selector,
                crawlerCode,
                modifiedDate: new Date(),
            }).save()))
        }
        syncCrawlerSchedule(crawlerCode, cronExpression)

        // log ra crawler đã được cập nhật
        console.log("Cập nhật crawler thành công...");

        return res.status(200).json("Cập nhật thành công!")
    } catch (error) {
        console.log(error);
        return res.status(400).json(`Request có vấn đề ${error.message}`)
    }
}


/**
* Mô tả : Crawl dữ liệu bằng selector đang có
* selector - xpath
* Created by: Nguyễn Hữu Lộc - MF1099
* Created date: 15:39 10/04/2022
*/

export const runCrawler = async (req, res) => {
    try {
        const { crawlerCode } = req.params

        // validate dữ liệu
        if (!crawlerCode) {
            return res.status(400).json('Không tìm thấy mã crawler đầu vào')
        }

        const crawler = await Crawlers.exists({
            crawlerCode,
            ownerUserId: req.user._id,
        })
        if (!crawler) {
            return res.status(404).json("Crawler does not exist.")
        }

        const result = await executeCrawler(crawlerCode)
        return res.status(200).json(result)
    } catch (error) {
        console.error(error);
        return res.status(error.statusCode || 500).json(`Unable to run crawler: ${error.message}`)
    }
}
