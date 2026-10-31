import mongoose from "mongoose";

let connectionPromise;

export async function connectDatabase() {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    if (!connectionPromise) {
        const mongoUri = process.env.MONGODB_URI
            || (process.env.VERCEL ? undefined : "mongodb://localhost:27017/crawlers");
        if (!mongoUri) {
            throw new Error("Set MONGODB_URI in the server environment.");
        }
        connectionPromise = mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
        }).then(() => mongoose.connection).catch((error) => {
            connectionPromise = undefined;
            throw error;
        });
    }
    return connectionPromise;
}
