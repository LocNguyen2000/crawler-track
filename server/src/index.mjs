import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import fileUpload from 'express-fileupload'

import crawlerRouter from './routes/crawler.routes.mjs'

const app = express()
const port = Number(process.env.PORT || 4000)
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crawlers'

try {
    await mongoose.connect(mongoUri)
} catch (error) {
    console.error('Unable to connect to MongoDB:', error)
    process.exit(1)
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(fileUpload())

app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' })
})

app.use('/crawler', crawlerRouter)

app.listen(port, () => {
    console.log(`App connected successfully on port ${port}`)
})
