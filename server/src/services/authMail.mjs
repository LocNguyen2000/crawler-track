const emailJsEndpoint = "https://api.emailjs.com/api/v1.0/email/send";

function getEmailJsCredentials(templateId, templateName) {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    if (!serviceId || !templateId || !publicKey || !privateKey) {
        throw new Error(
            `Configure EMAILJS_SERVICE_ID, ${templateName}, EMAILJS_PUBLIC_KEY, and EMAILJS_PRIVATE_KEY.`,
        );
    }

    return { serviceId, templateId, publicKey, privateKey };
}

async function sendEmailJsTemplate(credentials, templateParams) {
    const response = await fetch(emailJsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
            service_id: credentials.serviceId,
            template_id: credentials.templateId,
            user_id: credentials.publicKey,
            accessToken: credentials.privateKey,
            template_params: templateParams,
        }),
    });

    if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`EmailJS returned HTTP ${response.status}: ${detail}`);
    }
}

export function assertEmailJsConfiguration() {
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    return getEmailJsCredentials(templateId, "EMAILJS_TEMPLATE_ID");
}

export async function sendVerificationEmail(email, token) {
    const credentials = assertEmailJsConfiguration();

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
    const verificationUrl = new URL("/verify-email", appBaseUrl);
    verificationUrl.searchParams.set("token", token);
    await sendEmailJsTemplate(credentials, {
        to_email: email,
        verification_url: verificationUrl.toString(),
        app_name: "Spider-Man Crawler",
    });
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

export async function sendNewDataNotificationEmail(
    email,
    { crawlerName, crawlerCode, newRows },
) {
    const credentials = getEmailJsCredentials(
        process.env.EMAILJS_NOTIFICATION_TEMPLATE_ID,
        "EMAILJS_NOTIFICATION_TEMPLATE_ID",
    );
    const newData = newRows.map(({ __crawlerStatus: _status, ...row }) => row);

    await sendEmailJsTemplate(credentials, {
        to_email: email,
        crawler_name: crawlerName,
        crawler_code: crawlerCode,
        new_data_count: newData.length,
        new_data_json: escapeHtml(JSON.stringify(newData, null, 2)),
        app_name: "Spider-Man Crawler",
    });
}
