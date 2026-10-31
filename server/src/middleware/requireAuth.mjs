import { Users } from "../model/auth.mjs";
import { verifyAccessToken } from "../services/authSecurity.mjs";

export async function requireAuth(req, res, next) {
    const authorization = req.get("authorization") || "";
    const [scheme, token, ...extra] = authorization.split(" ");
    if (scheme !== "Bearer" || !token || extra.length) {
        return res.status(401).json({ message: "Authentication required." });
    }

    let payload;
    try {
        payload = await verifyAccessToken(token);
    } catch {
        return res.status(401).json({ message: "Your session has expired. Please sign in again." });
    }

    const user = await Users.findById(payload.sub).select("_id email emailVerified");
    if (!user || !user.emailVerified) {
        return res.status(401).json({ message: "Authentication required." });
    }
    req.user = user;
    return next();
}
