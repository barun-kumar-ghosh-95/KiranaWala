/**
 * KiranaWala AI — Customer AI Routes
 *
 * Exposes the authenticated AI chat endpoint.
 *
 * Security model:
 *  - authenticateToken: validates JWT, returns 401 if absent/invalid
 *  - requireCustomer:   checks role === 'customer', returns 403 for store-owners
 *  - Request validation: message must be a non-empty string, max 2000 chars
 *  - Error handling: provider errors → 503, validation → 400, auth → 401/403
 *  - API key is NEVER returned in any response
 *  - Stack traces are NEVER returned in any response
 */

"use strict";

const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authenticateToken } = require("../middleware/authMiddleware");
const { processChat } = require("../services/ai/aiService");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed length for a customer AI message (characters). */
const MAX_MESSAGE_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Rate Limiter Middleware
// ---------------------------------------------------------------------------

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

/**
 * In-memory rate-limiter for customer AI chat endpoint.
 * Prevents flood attacks and runaway provider API costs.
 */
const aiRateLimiter = (req, res, next) => {
  const key =
    (req.user && (req.user.id || req.user.userId)) || req.ip || "global";
  const now = Date.now();

  const userRecord = rateLimitMap.get(key) || {
    count: 0,
    resetTime: now + RATE_LIMIT_WINDOW_MS,
  };

  if (now > userRecord.resetTime) {
    userRecord.count = 1;
    userRecord.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    userRecord.count += 1;
  }

  rateLimitMap.set(key, userRecord);

  if (userRecord.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      message:
        "Too many AI requests. Please wait a minute before trying again.",
    });
  }

  next();
};

/**
 * Clears internal rate-limiter records (exported for test isolation).
 */
function resetRateLimiter() {
  rateLimitMap.clear();
}

// ---------------------------------------------------------------------------
// Middleware: requireCustomer
// ---------------------------------------------------------------------------

/**
 * Ensures the authenticated user has the 'customer' role.
 * Must be used after authenticateToken.
 *
 * Returns 403 if:
 *  - User is not found in the database
 *  - User's role is not 'customer' (e.g., store-owner)
 */
const requireCustomer = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await User.findById(req.user.id).select("role").lean();
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }

    if (user.role !== "customer") {
      return res
        .status(403)
        .json({ message: "Access denied: customer role required" });
    }

    next();
  } catch (err) {
    console.error("[aiRoutes] requireCustomer error:", err.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/customer/ai/chat
// ---------------------------------------------------------------------------

/**
 * Authenticated customer AI chat endpoint.
 *
 * Request body:
 * {
 *   "message": "string (required, max 2000 chars)",
 *   "context": { "latitude": number, "longitude": number } // optional
 * }
 *
 * Success response (200):
 * {
 *   "message": "string",
 *   "products": [...],
 *   "toolsUsed": ["string"]
 * }
 *
 * Error responses:
 *  400 — validation failure (missing/invalid message)
 *  401 — unauthenticated
 *  403 — wrong role
 *  429 — rate limit exceeded
 *  503 — AI provider not configured or unavailable
 *  500 — unexpected internal error
 */
router.post(
  "/chat",
  authenticateToken,
  requireCustomer,
  aiRateLimiter,
  async (req, res) => {
    const { message, context } = req.body;

    // --- Input Validation ---

    if (message === undefined || message === null) {
      return res.status(400).json({ message: "message is required" });
    }

    if (typeof message !== "string") {
      return res.status(400).json({ message: "message must be a string" });
    }

    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      return res.status(400).json({ message: "message must not be empty" });
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: `message must not exceed ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    // Optional context (location hints etc.) — validated loosely
    const userContext =
      context && typeof context === "object" && !Array.isArray(context)
        ? context
        : {};

    // --- AI Processing ---

    try {
      const result = await processChat({
        message: trimmedMessage,
        userContext,
      });

      return res.json({
        message: result.message,
        products: result.products || [],
        toolsUsed: result.toolsUsed || [],
      });
    } catch (err) {
      // Provider-not-configured error → 503 Service Unavailable
      if (err.code === "AI_PROVIDER_NOT_CONFIGURED") {
        return res.status(503).json({
          message:
            "The AI assistant is temporarily unavailable. Please try again later.",
        });
      }

      // All other errors → 500, but NEVER expose stack traces or credentials
      console.error("[aiRoutes] processChat error:", err.message);
      return res.status(500).json({
        message:
          "The AI assistant encountered an unexpected error. Please try again.",
      });
    }
  },
);

router.resetRateLimiter = resetRateLimiter;
module.exports = router;
