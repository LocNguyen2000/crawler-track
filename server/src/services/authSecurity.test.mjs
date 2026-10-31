import assert from "node:assert/strict";
import { test } from "node:test";
import {
    createAccessToken,
    createOpaqueToken,
    hashPassword,
    hashToken,
    verifyAccessToken,
    verifyPassword,
} from "./authSecurity.mjs";

test("password hashes verify only the original password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.notEqual(hash, "correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
    assert.equal(await verifyPassword("wrong password", hash), false);
    assert.equal(await verifyPassword("password", "invalid"), false);
});

test("opaque tokens are unpredictable and stored as one-way hashes", () => {
    const token = createOpaqueToken();
    assert.equal(token.length, 43);
    assert.notEqual(hashToken(token), token);
    assert.equal(hashToken(token), hashToken(token));
    assert.notEqual(hashToken(token), hashToken(createOpaqueToken()));
});

test("access tokens carry the account identity and reject a wrong signing key", async () => {
    const originalSecret = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = "test-only-signing-secret-that-is-long-enough";
    try {
        const token = await createAccessToken({
            _id: { toString: () => "user-id" },
            email: "user@example.com",
        });
        const payload = await verifyAccessToken(token);
        assert.equal(payload.sub, "user-id");
        assert.equal(payload.email, "user@example.com");

        process.env.AUTH_JWT_SECRET = "another-test-signing-secret-that-is-long";
        await assert.rejects(verifyAccessToken(token));
    } finally {
        if (originalSecret === undefined) delete process.env.AUTH_JWT_SECRET;
        else process.env.AUTH_JWT_SECRET = originalSecret;
    }
});
