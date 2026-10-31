import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(rootDirectory, "server", "package.json"));
const { config } = require("dotenv");
const mongoose = require("mongoose");

config({ path: path.join(rootDirectory, "server", ".env"), quiet: true });

const batchSize = 500;
const args = process.argv.slice(2);

if (args.includes("--help")) {
    console.log(`Migrate local MongoDB data to a remote MongoDB database.

Usage:
  npm run db:migrate                 Preview document counts (default)
  npm run db:migrate -- --apply      Upsert source documents into the target

Environment:
  MONGODB_SOURCE_URI  Source URI (defaults to MONGODB_URI, then local MongoDB)
  MONGODB_TARGET_URI  Required destination URI

The migration does not drop collections or delete destination-only documents.`);
    process.exit(0);
}

if (args.some((arg) => arg !== "--apply") || args.filter((arg) => arg === "--apply").length > 1) {
    console.error("Unknown or duplicate options. Run with --help for usage.");
    process.exit(2);
}

const applyChanges = args.includes("--apply");
const sourceUri = process.env.MONGODB_SOURCE_URI
    || process.env.MONGODB_URI
    || "mongodb://localhost:27017/crawlers";
const targetUri = process.env.MONGODB_TARGET_URI;

if (!targetUri) {
    console.error("Set MONGODB_TARGET_URI in server/.env before running the migration.");
    process.exit(2);
}

function indexOptions(index) {
    const { key, ns, v, background, ...options } = index;
    return { key, ...options };
}

async function migrateCollection(sourceDb, targetDb, collectionInfo) {
    const { name } = collectionInfo;
    const sourceCollection = sourceDb.collection(name);
    const targetCollection = targetDb.collection(name);
    const sourceCount = await sourceCollection.countDocuments();
    const targetCount = await targetCollection.countDocuments();

    console.info(`${name}: ${sourceCount} source document(s), ${targetCount} already at destination.`);
    if (!applyChanges || sourceCount === 0) return;

    const indexes = (await sourceCollection.indexes())
        .filter((index) => index.name !== "_id_")
        .map(indexOptions);
    if (indexes.length) {
        await targetCollection.createIndexes(indexes);
    }

    let batch = [];
    let migratedCount = 0;
    const flush = async () => {
        if (!batch.length) return;
        const operations = batch.map((document) => ({
            replaceOne: {
                filter: { _id: document._id },
                replacement: document,
                upsert: true,
            },
        }));
        await targetCollection.bulkWrite(operations, { ordered: false });
        migratedCount += batch.length;
        batch = [];
    };

    for await (const document of sourceCollection.find({}).batchSize(batchSize)) {
        batch.push(document);
        if (batch.length >= batchSize) await flush();
    }
    await flush();
    console.info(`${name}: upserted ${migratedCount} source document(s).`);
}

let sourceConnection;
let targetConnection;
try {
    sourceConnection = await mongoose
        .createConnection(sourceUri, { serverSelectionTimeoutMS: 10000 })
        .asPromise();
    targetConnection = await mongoose
        .createConnection(targetUri, { serverSelectionTimeoutMS: 10000 })
        .asPromise();

    if (
        sourceConnection.host === targetConnection.host
        && sourceConnection.name === targetConnection.name
    ) {
        throw new Error("Source and destination resolve to the same database.");
    }

    const sourceDb = sourceConnection.db;
    const targetDb = targetConnection.db;
    const collections = await sourceDb.listCollections(
        { type: "collection" },
        { nameOnly: true },
    ).toArray();

    console.info(
        `${applyChanges ? "Applying migration" : "Dry run"}: `
        + `${collections.length} collection(s) from "${sourceConnection.name}" `
        + `to "${targetConnection.name}".`,
    );
    for (const collectionInfo of collections) {
        await migrateCollection(sourceDb, targetDb, collectionInfo);
    }
    console.info(applyChanges
        ? "Migration completed. Destination-only documents were left unchanged."
        : "Dry run complete. Re-run with --apply to migrate source documents.");
} catch (error) {
    console.error("MongoDB migration failed:", error.name || "Error", error.code || "");
    process.exitCode = 1;
} finally {
    await Promise.all(
        [sourceConnection, targetConnection]
            .filter(Boolean)
            .map(async (connection) => {
                try {
                    await connection.close();
                } catch (error) {
                    console.error(
                        "Unable to close MongoDB migration connection:",
                        error.name || "Error",
                        error.code || "",
                    );
                }
            }),
    );
}
