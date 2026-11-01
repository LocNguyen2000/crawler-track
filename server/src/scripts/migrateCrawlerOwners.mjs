import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { config } from "dotenv";
import { Users } from "../model/auth.mjs";
import { Crawlers } from "../model/index.mjs";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: path.join(serverDirectory, ".env") });

const args = process.argv.slice(2);
if (args.includes("--help")) {
    console.log(`Assign existing crawlers to the oldest existing administrator.

Usage:
  npm run db:migrate:crawler-owners                 Preview the migration
  npm run db:migrate:crawler-owners -- --apply       Apply the migration

The migration also marks accounts without a role as administrators and runs
only once per database.`);
    process.exit(0);
}

if (args.some((arg) => arg !== "--apply") || args.filter((arg) => arg === "--apply").length > 1) {
    console.error("Unknown or duplicate options. Run with --help for usage.");
    process.exit(2);
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
    console.error("Set MONGODB_URI in server/.env before running the migration.");
    process.exit(2);
}

const applyChanges = args.includes("--apply");
const migrationId = "crawler-owners-v1";

try {
    await mongoose.connect(mongoUri);
    const database = mongoose.connection.db;
    const migrations = database.collection("applicationMigrations");

    if (await migrations.findOne({ _id: migrationId })) {
        console.info("Crawler ownership migration has already been applied.");
        process.exitCode = 0;
    } else {
        const adminFilter = {
            $or: [
                { role: "admin" },
                { role: { $exists: false } },
            ],
        };
        const existingAdmin = await Users.collection
            .find(adminFilter)
            .sort({ createdAt: 1, _id: 1 })
            .limit(1)
            .next();
        if (!existingAdmin) {
            throw new Error("No existing administrator account was found.");
        }

        const crawlerCount = await Crawlers.countDocuments();
        console.info(
            `${applyChanges ? "Applying" : "Dry run"}: assign ${crawlerCount} crawler(s) `
            + `to the oldest existing administrator (${existingAdmin.email}).`,
        );

        if (applyChanges) {
            await Users.collection.updateMany(
                { role: { $exists: false } },
                { $set: { role: "admin" } },
            );
            await Crawlers.updateMany(
                {},
                { $set: { ownerUserId: existingAdmin._id } },
            );
            await migrations.insertOne({
                _id: migrationId,
                completedAt: new Date(),
                administratorId: existingAdmin._id,
                assignedCrawlerCount: crawlerCount,
            });
            console.info("Crawler ownership migration completed.");
        } else {
            console.info("Dry run complete. Re-run with --apply to assign ownership.");
        }
    }
} catch (error) {
    console.error("Crawler ownership migration failed:", error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
