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
