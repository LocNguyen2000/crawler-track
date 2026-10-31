import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Invitations, RefreshTokens, Users } from "../model/auth.mjs";
import { getCorsOrigins } from "../config/corsOrigins.mjs";
import {
    createAccessToken,
    createOpaqueToken,
    hashPassword,
    hashToken,
    refreshTokenLifetimeMs,
    verifyPassword,
} from "../services/authSecurity.mjs";
import {
    assertEmailJsConfiguration,
    sendVerificationEmail,
} from "../services/authMail.mjs";

const router = Router();
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});
const cookieName = "refreshToken";

router.use(authLimiter);
router.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && !getCorsOrigins().includes(origin)) {
        return res.status(403).json({ message: "This origin is not allowed." });
    }
    return next();
});

function refreshCookieOptions() {
    const sameSite = (process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
    if (!["strict", "lax", "none"].includes(sameSite)) {
        throw new Error("AUTH_COOKIE_SAME_SITE must be strict, lax, or none.");
    }
    const secure = process.env.AUTH_COOKIE_SECURE === "true"
        || (process.env.AUTH_COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production");
    if (sameSite === "none" && !secure) {
        throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is none.");
    }
    return {
        httpOnly: true,
        secure,
        sameSite,
        path: "/auth",
        maxAge: refreshTokenLifetimeMs,
    };
}

export function assertAuthCookieConfiguration() {
    refreshCookieOptions();
}

function setRefreshCookie(res, token) {
    res.cookie(cookieName, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
    const { maxAge, ...options } = refreshCookieOptions();
    res.clearCookie(cookieName, options);
}

async function createSession(user, res) {
    const rawRefreshToken = createOpaqueToken();
    await RefreshTokens.create({
        userId: user._id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
    });
    setRefreshCookie(res, rawRefreshToken);
    return {
        accessToken: await createAccessToken(user),
        user: { id: user._id.toString(), email: user.email },
    };
}

function normalizeEmail(email) {
    return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function validEmail(email) {
    return email.length <= 254
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
    return typeof password === "string"
        && Buffer.byteLength(password, "utf8") >= 12
        && Buffer.byteLength(password, "utf8") <= 1024;
}

router.post("/signup", async (req, res, next) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const inviteToken = req.body?.inviteToken;
    if (!validEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (!validPassword(password)) {
        return res.status(400).json({ message: "Password must be 12 to 1024 bytes." });
    }
    if (typeof inviteToken !== "string" || inviteToken.length < 32) {
        return res.status(400).json({ message: "A valid invitation link is required." });
    }
    try {
        assertEmailJsConfiguration();
    } catch (error) {
        console.error("Email verification is not configured:", error.message);
        return res.status(503).json({ message: "Email verification is not configured on the server." });
    }

    try {
        if (await Users.exists({ email })) {
            return res.status(409).json({ message: "An account with that email already exists." });
        }
        const now = new Date();
        const invitation = await Invitations.findOneAndUpdate(
            {
                email,
                tokenHash: hashToken(inviteToken),
                expiresAt: { $gt: now },
                usedAt: null,
            },
            { $set: { usedAt: now } },
            { new: true },
        );
        if (!invitation) {
            return res.status(400).json({ message: "This invitation is invalid, expired, or already used." });
        }

        const verificationToken = createOpaqueToken();
        const user = await Users.create({
            email,
            passwordHash: await hashPassword(password),
            emailVerified: false,
            verificationTokenHash: hashToken(verificationToken),
            verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        try {
            await sendVerificationEmail(user.email, verificationToken);
        } catch (error) {
            console.error("Unable to send account verification email:", error);
            return res.status(503).json({
                message: "Your account was created, but verification email delivery failed. Use resend verification after mail service is available.",
            });
        }
        return res.status(201).json({ message: "Account created. Check your email to verify it before signing in." });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with that email already exists." });
        }
        return next(error);
    }
});

router.post("/verify-email", async (req, res, next) => {
    const token = req.body?.token;
    if (typeof token !== "string" || token.length < 32) {
        return res.status(400).json({ message: "A valid verification link is required." });
    }
    try {
        const user = await Users.findOneAndUpdate(
            {
                verificationTokenHash: hashToken(token),
                verificationExpiresAt: { $gt: new Date() },
                emailVerified: false,
            },
            {
                $set: { emailVerified: true },
                $unset: { verificationTokenHash: 1, verificationExpiresAt: 1 },
            },
            { new: true },
        );
        if (!user) {
            return res.status(400).json({ message: "This verification link is invalid, expired, or already used." });
        }
        return res.status(200).json({ message: "Email verified. You can now sign in." });
    } catch (error) {
        return next(error);
    }
});

router.post("/resend-verification", async (req, res, next) => {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }
    try {
        assertEmailJsConfiguration();
    } catch (error) {
        console.error("Email verification is not configured:", error.message);
        return res.status(503).json({ message: "Email verification is not configured on the server." });
    }
    try {
        const user = await Users.findOne({ email, emailVerified: false });
        if (user) {
            const token = createOpaqueToken();
            user.verificationTokenHash = hashToken(token);
            user.verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await user.save();
            await sendVerificationEmail(user.email, token);
        }
        return res.status(200).json({
            message: "If an unverified account exists for that address, a verification email has been sent.",
        });
    } catch (error) {
        console.error("Unable to resend account verification email:", error);
        return next(error);
    }
});

router.post("/login", async (req, res, next) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!validEmail(email) || typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) {
        return res.status(400).json({ message: "Enter a valid email address and password." });
    }
    try {
        const user = await Users.findOne({ email }).select("+passwordHash");
        const matches = user && await verifyPassword(password, user.passwordHash);
        if (!matches) {
            return res.status(401).json({ message: "Email or password is incorrect." });
        }
        if (!user.emailVerified) {
            return res.status(403).json({ message: "Verify your email before signing in." });
        }
        const session = await createSession(user, res);
        return res.status(200).json(session);
    } catch (error) {
        return next(error);
    }
});

router.post("/refresh", async (req, res, next) => {
    const rawToken = req.cookies?.[cookieName];
    if (!rawToken) {
        return res.status(401).json({ message: "No active session." });
    }
    try {
        const refreshToken = await RefreshTokens.findOneAndDelete({
            tokenHash: hashToken(rawToken),
            expiresAt: { $gt: new Date() },
        });
        if (!refreshToken) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: "Your session has expired. Please sign in again." });
        }
        const user = await Users.findById(refreshToken.userId).select("_id email emailVerified");
        if (!user || !user.emailVerified) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: "Authentication required." });
        }
        const session = await createSession(user, res);
        return res.status(200).json(session);
    } catch (error) {
        return next(error);
    }
});

router.post("/logout", async (req, res, next) => {
    try {
        const rawToken = req.cookies?.[cookieName];
        if (rawToken) {
            await RefreshTokens.deleteOne({ tokenHash: hashToken(rawToken) });
        }
        clearRefreshCookie(res);
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

export default router;
