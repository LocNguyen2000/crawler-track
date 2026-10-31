const emailJsEndpoint = "https://api.emailjs.com/api/v1.0/email/send";

export function assertEmailJsConfiguration() {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    if (!serviceId || !templateId || !publicKey || !privateKey) {
        throw new Error(
            "Configure EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, and EMAILJS_PRIVATE_KEY.",
        );
    }
}

export async function sendVerificationEmail(email, token) {
    assertEmailJsConfiguration();
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;

    const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
    const verificationUrl = new URL("/verify-email", appBaseUrl);
    verificationUrl.searchParams.set("token", token);
    const response = await fetch(emailJsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
                to_email: email,
                verification_url: verificationUrl.toString(),
                app_name: "Spider-Man Crawler",
            },
        }),
    });

    if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`EmailJS returned HTTP ${response.status}: ${detail}`);
    }
}
