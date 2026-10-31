const defaultOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
];

export function getCorsOrigins() {
    const configuredOrigins = process.env.CORS_ORIGIN
        ?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    return configuredOrigins?.length ? configuredOrigins : defaultOrigins;
}
