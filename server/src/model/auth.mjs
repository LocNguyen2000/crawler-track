import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved",
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "admin",
    },
    verificationTokenHash: { type: String, select: false },
    verificationExpiresAt: { type: Date, select: false },
}, { timestamps: true });

const invitationSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
}, { timestamps: true });

const refreshTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const Users = mongoose.model("User", userSchema);
export const Invitations = mongoose.model("Invitation", invitationSchema);
export const RefreshTokens = mongoose.model("RefreshToken", refreshTokenSchema);
