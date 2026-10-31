import assert from "node:assert/strict";
import test from "node:test";
import { validateCronExpression } from "./crawlerScheduler.mjs";

test("empty cron expressions disable scheduling", () => {
    assert.equal(validateCronExpression(""), "");
    assert.equal(validateCronExpression("   "), "");
    assert.equal(validateCronExpression(null), "");
});

test("valid five-field cron expressions are normalized", () => {
    assert.equal(validateCronExpression(" 0 9 * * * "), "0 9 * * *");
});

test("invalid expressions and six-field expressions are rejected", () => {
    assert.throws(() => validateCronExpression("invalid"), /five-field cron/);
    assert.throws(() => validateCronExpression("* * * * * *"), /five-field cron/);
});

test("Vercel rejects schedules that cannot persist in a serverless function", () => {
    const originalVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
        assert.equal(validateCronExpression(""), "");
        assert.throws(
            () => validateCronExpression("0 9 * * *"),
            /unavailable on Vercel serverless deployments/,
        );
    } finally {
        if (originalVercel === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = originalVercel;
    }
});
