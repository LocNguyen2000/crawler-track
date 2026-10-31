import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { config } from "dotenv";
import { Invitations, Users } from "../model/auth.mjs";
import { createOpaqueToken, hashToken } from "../services/authSecurity.mjs";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: path.join(serverDirectory, ".env") });

const email = process.argv[2]?.trim().toLowerCase();
if (!email || process.argv.length !== 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: npm run auth:invite -- user@example.com");
    process.exit(2);
}

let connected = false;
try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("Set MONGODB_URI in server/.env before creating an invitation.");
    }
    await mongoose.connect(mongoUri);
    connected = true;

    if (await Users.exists({ email })) {
        throw new Error("An account with that email already exists.");
    }
    await Invitations.deleteMany({ email, usedAt: null });
    const token = createOpaqueToken();
    await Invitations.create({
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
    const inviteUrl = new URL("/signup", appBaseUrl);
    inviteUrl.searchParams.set("invite", token);
    console.info(`Invitation created for ${email}; it expires in 72 hours.`);
    console.info(inviteUrl.toString());
} finally {
    if (connected) await mongoose.disconnect();
}
