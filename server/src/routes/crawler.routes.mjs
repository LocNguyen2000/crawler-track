import { Router } from "express";

import { getAllCrawlers, getCrawlerByCode, addCrawler, deleteCrawler, clearCrawlerOutputs, updateCrawler, generateNewCrawlerCode, runCrawler } from "../controllers/crawler.controller.mjs";
import { getPageSelectors, getSelectorsByCode } from "../controllers/selector.controller.mjs";

const router = Router()

router.get('/newCrawlerCode', generateNewCrawlerCode)
router.get('/', getAllCrawlers)
router.get('/:crawlerCode', getCrawlerByCode)
router.get('/selectors/:crawlerCode', getSelectorsByCode)

router.delete('/:crawlerCode', deleteCrawler)
router.delete('/:crawlerCode/outputs', clearCrawlerOutputs)

router.post('/', addCrawler)
router.post('/scrape/:crawlerCode', runCrawler)
router.post('/record/:crawlerCode', getPageSelectors)
// router.post('/:crawlerCode/upload', handleUrlsUpload)

router.put('/:crawlerCode', updateCrawler)



export default router