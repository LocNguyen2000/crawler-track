import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import fileUpload from 'express-fileupload'

import authRouter, { assertAuthCookieConfiguration } from './routes/auth.routes.mjs'
import crawlerRouter from './routes/crawler.routes.mjs'
import { requireAuth } from './middleware/requireAuth.mjs'
import { getCorsOrigins } from './config/corsOrigins.mjs'
import { restoreCrawlerSchedules } from './services/crawlerScheduler.mjs'
import { assertAuthConfiguration } from './services/authSecurity.mjs'

const app = express()
const port = Number(process.env.PORT || 4000)
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crawlers'
const corsOrigins = getCorsOrigins()

assertAuthConfiguration()
assertAuthCookieConfiguration()

try {
    await mongoose.connect(mongoUri)
    await restoreCrawlerSchedules()
} catch (error) {
    console.error('Unable to connect to MongoDB:', error)
    process.exit(1)
}

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(cookieParser())
app.use(fileUpload())

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.use('/auth', authRouter)
app.use('/crawler', requireAuth, crawlerRouter)

app.use((error, _req, res, _next) => {
    console.error('Unhandled API error:', error)
    res.status(500).json({ message: 'An unexpected server error occurred.' })
})

app.listen(port, () => {
    console.log(`App connected successfully on port ${port}`)
})
