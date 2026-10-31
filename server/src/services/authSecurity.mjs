import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";

const scrypt = promisify(scryptCallback);
const passwordKeyLength = 64;
const passwordCost = 32768;
const accessTokenLifetime = "15m";

function jwtKey() {
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
        throw new Error("AUTH_JWT_SECRET must contain at least 32 bytes.");
    }
    return new TextEncoder().encode(secret);
}

export function assertAuthConfiguration() {
    jwtKey();
}

export function createOpaqueToken() {
    return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = await scrypt(password, salt, passwordKeyLength, {
        N: passwordCost,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024,
    });
    return `scrypt$${passwordCost}$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password, encodedHash) {
    const [algorithm, cost, saltHex, hashHex] = encodedHash.split("$");
    if (
        algorithm !== "scrypt"
        || Number(cost) !== passwordCost
        || !/^[0-9a-f]{32}$/i.test(saltHex)
        || !/^[0-9a-f]{128}$/i.test(hashHex)
    ) {
        return false;
    }

    const expectedHash = Buffer.from(hashHex, "hex");
    const derivedKey = await scrypt(
        password,
        Buffer.from(saltHex, "hex"),
        expectedHash.length,
        { N: passwordCost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
    );
    return timingSafeEqual(expectedHash, derivedKey);
}

export async function createAccessToken(user) {
    return new SignJWT({ email: user.email })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user._id.toString())
        .setIssuedAt()
        .setExpirationTime(accessTokenLifetime)
        .sign(jwtKey());
}

export async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, jwtKey(), {
        algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
        throw new Error("Invalid access token claims.");
    }
    return payload;
}

export const refreshTokenLifetimeMs = 7 * 24 * 60 * 60 * 1000;
