import assert from "node:assert/strict";
import { test } from "node:test";
import {
    sendNewDataNotificationEmail,
    sendVerificationEmail,
} from "./authMail.mjs";

const emailJsVariables = [
    "EMAILJS_SERVICE_ID",
    "EMAILJS_TEMPLATE_ID",
    "EMAILJS_NOTIFICATION_TEMPLATE_ID",
    "EMAILJS_PUBLIC_KEY",
    "EMAILJS_PRIVATE_KEY",
    "APP_BASE_URL",
];

function preserveEnvironment() {
    return Object.fromEntries(
        emailJsVariables.map((key) => [key, process.env[key]]),
    );
}

function restoreEnvironment(original) {
    for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
}

test("verification email sends expected EmailJS template parameters", async () => {
    const originalEnvironment = preserveEnvironment();
    const originalFetch = globalThis.fetch;
    Object.assign(process.env, {
        EMAILJS_SERVICE_ID: "service_test",
        EMAILJS_TEMPLATE_ID: "template_test",
        EMAILJS_PUBLIC_KEY: "public_test",
        EMAILJS_PRIVATE_KEY: "private_test",
        APP_BASE_URL: "https://crawler.example",
    });

    let request;
    globalThis.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true };
    };

    try {
        await sendVerificationEmail("person@example.com", "verification-token");
        assert.equal(request.url, "https://api.emailjs.com/api/v1.0/email/send");
        const payload = JSON.parse(request.options.body);
        assert.equal(payload.service_id, "service_test");
        assert.equal(payload.template_id, "template_test");
        assert.equal(payload.user_id, "public_test");
        assert.equal(payload.accessToken, "private_test");
        assert.equal(payload.template_params.to_email, "person@example.com");
        assert.equal(
            payload.template_params.verification_url,
            "https://crawler.example/verify-email?token=verification-token",
        );
    } finally {
        globalThis.fetch = originalFetch;
        restoreEnvironment(originalEnvironment);
    }
});

test("verification email reports provider failures", async () => {
    const originalEnvironment = preserveEnvironment();
    const originalFetch = globalThis.fetch;
    Object.assign(process.env, {
        EMAILJS_SERVICE_ID: "service_test",
        EMAILJS_TEMPLATE_ID: "template_test",
        EMAILJS_PUBLIC_KEY: "public_test",
        EMAILJS_PRIVATE_KEY: "private_test",
    });
    globalThis.fetch = async () => ({ ok: false, status: 429, text: async () => "Rate limit" });

    try {
        await assert.rejects(
            sendVerificationEmail("person@example.com", "verification-token"),
            /EmailJS returned HTTP 429: Rate limit/,
        );
    } finally {
        globalThis.fetch = originalFetch;
        restoreEnvironment(originalEnvironment);
    }
});

test("new-data email sends escaped crawler rows to the notification template", async () => {
    const originalEnvironment = preserveEnvironment();
    const originalFetch = globalThis.fetch;
    Object.assign(process.env, {
        EMAILJS_SERVICE_ID: "service_test",
        EMAILJS_NOTIFICATION_TEMPLATE_ID: "template_notifications",
        EMAILJS_PUBLIC_KEY: "public_test",
        EMAILJS_PRIVATE_KEY: "private_test",
    });

    let request;
    globalThis.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true };
    };

    try {
        await sendNewDataNotificationEmail("owner@example.com", {
            crawlerName: "Example crawler",
            crawlerCode: "CRWL-1",
            newRows: [
                { title: "<script>alert(1)</script>", __crawlerStatus: "NEW" },
            ],
        });

        const payload = JSON.parse(request.options.body);
        assert.equal(payload.template_id, "template_notifications");
        assert.equal(payload.template_params.to_email, "owner@example.com");
        assert.equal(payload.template_params.crawler_name, "Example crawler");
        assert.equal(payload.template_params.crawler_code, "CRWL-1");
        assert.equal(payload.template_params.new_data_count, 1);
        assert.match(payload.template_params.new_data_json, /&lt;script&gt;/);
        assert.doesNotMatch(payload.template_params.new_data_json, /<script>/);
    } finally {
        globalThis.fetch = originalFetch;
        restoreEnvironment(originalEnvironment);
    }
});
