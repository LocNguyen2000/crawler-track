import mongoose from 'mongoose'

const selectorSchema = new mongoose.Schema({
    crawlerCode: { type: String, required: true },
    index: { type: Number },
    metadata: { type: String },
    tag: {type: String},
    selectorXPath: {type: String},
    selectorCSS: {type: String},
    eventType: {type: String},
    modifiedDate: { type: Date }
})

const dataSchema = new mongoose.Schema({
    crawlerCode: { type: String, required: true},
    data: { type: mongoose.Schema.Types.Mixed },
    modifiedDate: { type: Date }
})

const crawlerSchema = new mongoose.Schema({
    crawlerCode: { type: String, required: true, unique: true},
    crawlerName: { type: String, required: true },
    selectorType: { type: String },
    urls: { type: Array },
    description: {type: String },
    modifiedDate: { type: Date },
    performance: {type: String},
    cronExpression: { type: String, trim: true, default: "" },
    headless: { type: Boolean, default: process.env.PUPPETEER_HEADLESS === "true" }
})

export const Crawlers = mongoose.model('crawler', crawlerSchema)
export const Selectors = mongoose.model('selector', selectorSchema)
export const Data = mongoose.model('data', dataSchema)
