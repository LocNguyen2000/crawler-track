import "dotenv/config";
import app from "./app.mjs";
import { connectDatabase } from "./services/database.mjs";
import { restoreCrawlerSchedules } from "./services/crawlerScheduler.mjs";

if (!process.env.VERCEL) {
    const port = Number(process.env.PORT || 4000);
    try {
        await connectDatabase();
        await restoreCrawlerSchedules();
        app.listen(port, () => {
            console.log(`App connected successfully on port ${port}`);
        });
    } catch (error) {
        console.error("Unable to start the server:", error);
        process.exit(1);
    }
}

export default app;
