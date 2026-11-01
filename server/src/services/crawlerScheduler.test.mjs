import assert from "node:assert/strict";
import test from "node:test";
import {
    matchesScheduleAt,
    validateCronExpression,
} from "./crawlerScheduler.mjs";

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

test("valid schedules are accepted on Vercel for the centralized cron dispatcher", () => {
    const originalVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
        assert.equal(validateCronExpression(""), "");
        assert.equal(validateCronExpression("0 9 * * *"), "0 9 * * *");
    } finally {
        if (originalVercel === undefined) delete process.env.VERCEL;
        else process.env.VERCEL = originalVercel;
    }
});

test("scheduled matching uses Vietnam time and ignores request seconds", () => {
    assert.equal(
        matchesScheduleAt("30 9 * * *", new Date("2026-11-01T02:30:00.000Z")),
        true,
    );
    assert.equal(
        matchesScheduleAt("30 9 * * *", new Date("2026-11-01T02:31:00.000Z")),
        false,
    );
});
