/**
 * KiranaWala AI — Service (Orchestration Layer)
 *
 * Responsibilities:
 *  1. Accept a customer message and optional context
 *  2. Create a provider conversation session (via aiProviderAdapter)
 *  3. Run the tool-calling loop (max MAX_TOOL_ITERATIONS iterations)
 *  4. Dispatch validated, read-only tool calls to aiTools.js
 *  5. Feed tool results back to the model
 *  6. Return a final safe, shaped response
 *
 * Callers (aiRoutes.js) receive ONLY the final { message, toolsUsed } —
 * never raw provider output, chain-of-thought, or tool arguments.
 *
 * Tool-calling flow:
 *
 *   User message
 *       ↓
 *   conversation.send(text)
 *       ↓
 *   Model response
 *       ↓ (if functionCall parts)
 *   executeTool(name, args)
 *       ↓
 *   aiTools.js → MongoDB (read-only)
 *       ↓
 *   conversation.send([functionResponse parts])
 *       ↓
 *   Model response (text — final answer)
 *       ↓
 *   { message, toolsUsed }
 */

"use strict";

const { createConversation } = require("./aiProviderAdapter");
const { KIRANAWALA_SYSTEM_PROMPT } = require("./aiPrompts");
const aiTools = require("./aiTools");

const MAX_TOOL_ITERATIONS = 5;

// ---------------------------------------------------------------------------
// Tool Declarations (Gemini function calling format)
// ---------------------------------------------------------------------------

/**
 * Describes the tools available to the model.
 * The model uses these declarations to decide when and how to call tools.
 */
const TOOL_DECLARATIONS = [
  {
    name: "searchProducts",
    description:
      "Search for grocery products available on KiranaWala. Results only include in-stock, available products. Use this when a customer asks to find, search, or discover products.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description:
            "Free text search term (e.g. 'atta', 'cooking oil', 'dairy')",
        },
        storeId: {
          type: "STRING",
          description: "Optional: filter results to a specific store by its ID",
        },
        category: {
          type: "STRING",
          description:
            "Optional: filter by product category (e.g. 'Groceries', 'Dairy', 'Beverages')",
        },
        limit: {
          type: "NUMBER",
          description:
            "Maximum number of results to return (server caps this at 20)",
        },
      },
    },
  },
  {
    name: "getNearbyStores",
    description:
      "Find KiranaWala stores near a geographic location. Use this when the customer asks about nearby stores or what stores are available in their area.",
    parameters: {
      type: "OBJECT",
      properties: {
        latitude: {
          type: "NUMBER",
          description: "The customer's latitude coordinate (WGS-84, -90 to 90)",
        },
        longitude: {
          type: "NUMBER",
          description:
            "The customer's longitude coordinate (WGS-84, -180 to 180)",
        },
        radiusKm: {
          type: "NUMBER",
          description: "Search radius in kilometres (default 8, maximum 50)",
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "getProductDetails",
    description:
      "Get full details for a specific product by its ID. Use this when the customer wants more information about a product found via searchProducts.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "The product's unique ID",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "checkProductAvailability",
    description:
      "Check whether a specific product is currently in stock and available for purchase. Always call this to confirm availability — never assume a product is in stock without checking.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "The product's unique ID",
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "buildShoppingIntentBasket",
    description:
      "Build a complete single-store grocery basket matching a customer's shopping intent (e.g., 'tea for 5', 'breakfast for 4', 'snacks for movie night', 'groceries under ₹200').",
    parameters: {
      type: "OBJECT",
      properties: {
        purpose: {
          type: "STRING",
          description:
            "The meal or purpose (e.g., 'make tea', 'breakfast', 'movie night snacks')",
        },
        servings: {
          type: "NUMBER",
          description: "Number of people/servings",
        },
        budget: {
          type: "NUMBER",
          description: "Maximum budget in INR",
        },
        items: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Required ingredient names",
        },
      },
      required: ["purpose"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Executor Map
// ---------------------------------------------------------------------------

const { parseShoppingIntent, buildIntentBasket } = require("./aiIntentBasket");

/**
 * Maps tool declaration names to their read-only aiTools.js implementations.
 * This is the ONLY bridge between the model's tool requests and the database.
 */
const TOOL_EXECUTORS = {
  searchProducts: aiTools.searchProducts,
  getNearbyStores: aiTools.getNearbyStores,
  getProductDetails: aiTools.getProductDetails,
  checkProductAvailability: aiTools.checkProductAvailability,
  buildShoppingIntentBasket: aiTools.buildShoppingIntentBasket,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of tool-call/response cycles per request.
 * Prevents runaway API costs and infinite tool loops.
 * The loop covers: initial send + up to (MAX-1) tool response rounds.
 */
// ---------------------------------------------------------------------------
const mongoose = require("mongoose");
const Product = require("../../models/product");

// ---------------------------------------------------------------------------
// Observability Logger
// ---------------------------------------------------------------------------

/**
 * Safe, structured observability logger.
 * Never logs credentials, API keys, passwords, or PII.
 *
 * @param {string} eventType - 'AI_REQUEST' | 'AI_TOOL_CALL' | 'AI_RESPONSE' | 'AI_ERROR'
 * @param {object} details - Safe event details
 */
function logAIEvent(eventType, details = {}) {
  const timestamp = new Date().toISOString();
  const safeDetails = { ...details };

  delete safeDetails.apiKey;
  delete safeDetails.secret;
  delete safeDetails.authorization;
  delete safeDetails.password;

  console.log(
    `[AI_OBSERVABILITY] ${timestamp} | EVENT: ${eventType} | ${JSON.stringify(safeDetails)}`,
  );
}

// ---------------------------------------------------------------------------
// Server-Side Product Verification
// ---------------------------------------------------------------------------

/**
 * Strictly verifies candidate product IDs against live MongoDB documents.
 * Discards nonexistent, deleted, out-of-stock, or invalid products.
 * Never trusts LLM-provided prices, stock levels, or product metadata.
 *
 * @param {Array<string>} candidateIds
 * @returns {Promise<Array<object>>} Safe, verified product objects
 */
async function verifyRecommendedProducts(candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return [];
  }

  const validIds = Array.from(
    new Set(
      candidateIds.filter(
        (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id),
      ),
    ),
  );

  if (validIds.length === 0) return [];

  const docs = await Product.find({
    _id: { $in: validIds.map((id) => new mongoose.Types.ObjectId(id)) },
    available: { $ne: false },
    stock: { $gt: 0 },
  })
    .select("name price description category stock available store image")
    .populate("store", "name category description")
    .lean();

  const verified = [];
  for (const doc of docs) {
    if (!doc.store) continue;

    const storeObj = typeof doc.store === "object" ? doc.store : null;
    if (!storeObj || (!storeObj._id && !storeObj.id)) continue;

    const storeId = storeObj._id
      ? storeObj._id.toString()
      : storeObj.id.toString();

    verified.push({
      _id: doc._id.toString(),
      name: doc.name,
      price: doc.price,
      stock: doc.stock,
      available: doc.available !== false && doc.stock > 0,
      category: doc.category || "General",
      description: doc.description || "",
      image: doc.image || null,
      store: {
        _id: storeId,
        name: storeObj.name || "Local Store",
        category: storeObj.category || "General",
      },
    });
  }

  return verified;
}

// ---------------------------------------------------------------------------
// Internal: Tool Execution
// ---------------------------------------------------------------------------

/**
 * Safely executes a single named tool with the provided arguments.
 * Returns a structured result — never throws — so the model can
 * reason about tool failures without crashing the service.
 *
 * @param {string} name - Tool name from TOOL_DECLARATIONS
 * @param {object} args - Arguments provided by the model
 * @returns {Promise<object>} Tool result or error object
 */
async function executeTool(name, args) {
  const executor = TOOL_EXECUTORS[name];

  if (!executor) {
    // Unknown tool name — return a structured error the model can interpret
    return { error: `Unknown tool requested: '${name}'` };
  }

  try {
    return await executor(args);
  } catch (err) {
    // Tool validation/DB error — surface as structured error, not a crash
    return {
      error: `Tool '${name}' encountered an error: ${err.message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Main Export: processChat
// ---------------------------------------------------------------------------

/**
 * Processes a customer's AI chat message through the full tool-calling loop.
 *
 * Algorithm:
 *   1. Create a stateful conversation session
 *   2. Send the user's message (iteration 0)
 *   3. If response is text → return text + verified products
 *   4. If response has function calls → execute tools, collect products
 *   5. Repeat steps 3–4 until text or MAX_TOOL_ITERATIONS
 *   6. Run verifyRecommendedProducts against DB
 *
 * @param {object} params
 * @param {string}  params.message       - The customer's trimmed message
 * @param {object}  [params.userContext] - Optional context (e.g., location hints)
 *
 * @returns {Promise<{ message: string, products: object[], toolsUsed: string[] }>}
 *
 * @throws {Error} with code AI_PROVIDER_NOT_CONFIGURED — caught by route → 503
 *         Other provider errors propagate to route → 500
 */
async function processChat({ message, userContext = {} }) {
  logAIEvent("AI_REQUEST", {
    messageLength: message.length,
    hasContext: Object.keys(userContext).length > 0,
  });

  const conversation = createConversation({
    systemPrompt: KIRANAWALA_SYSTEM_PROMPT,
    tools: TOOL_DECLARATIONS,
  });

  // --- Shopping Intent Handler ---
  const parsedIntent = parseShoppingIntent(message);

  if (parsedIntent.isIntent) {
    if (parsedIntent.isAmbiguous) {
      logAIEvent("AI_RESPONSE", { ambiguousIntent: true });
      return {
        message: parsedIntent.clarificationPrompt,
        products: [],
        toolsUsed: [],
        intent: null,
        basket: null,
      };
    }

    const intentResult = await buildIntentBasket({
      purpose: parsedIntent.purpose,
      servings: parsedIntent.servings,
      budget: parsedIntent.budget,
      requiredItems: parsedIntent.requiredItems,
      userContext,
    });

    logAIEvent("AI_RESPONSE", {
      intentBasket: true,
      productsCount: intentResult.products.length,
    });

    return {
      message: intentResult.message,
      products: intentResult.products,
      toolsUsed: ["buildShoppingIntentBasket"],
      intent: intentResult.intent,
      basket: intentResult.basket,
    };
  }

  const toolsUsed = [];
  const candidateProductIds = new Set();

  let currentPayload = message;
  if (userContext && Object.keys(userContext).length > 0) {
    currentPayload = `[Context: ${JSON.stringify(userContext)}]\n\n${message}`;
  }

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const result = await conversation.send(currentPayload);

      const candidate = result.response.candidates?.[0];
      if (!candidate) {
        throw new Error("AI provider returned no candidates in response");
      }

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter((p) => p.functionCall);
      const textParts = parts.filter((p) => p.text);

      // ── Final answer: model returned text ────────────────────────────────
      if (textParts.length > 0 || functionCalls.length === 0) {
        const finalText = textParts
          .map((p) => p.text)
          .join("")
          .trim();

        const objectIdRegex = /\b[0-9a-fA-F]{24}\b/g;
        const textMatches = finalText.match(objectIdRegex) || [];
        textMatches.forEach((id) => candidateProductIds.add(id));

        const verifiedProducts = await verifyRecommendedProducts(
          Array.from(candidateProductIds),
        );

        const responseObj = {
          message:
            finalText ||
            "I couldn't find relevant information for your request. Please try rephrasing.",
          products: verifiedProducts,
          toolsUsed,
        };

        logAIEvent("AI_RESPONSE", {
          productsCount: verifiedProducts.length,
          toolsUsedCount: toolsUsed.length,
        });

        return responseObj;
      }

      // ── Tool calls: execute each and build function response parts ────────
      const functionResponseParts = [];

      for (const part of functionCalls) {
        const { name, args } = part.functionCall;

        if (!toolsUsed.includes(name)) {
          toolsUsed.push(name);
        }

        logAIEvent("AI_TOOL_CALL", {
          toolName: name,
          argKeys: Object.keys(args || {}),
        });

        const toolResult = await executeTool(name, args);

        if (toolResult && Array.isArray(toolResult.products)) {
          toolResult.products.forEach((p) => {
            if (p && p.productId) candidateProductIds.add(p.productId);
          });
        } else if (
          toolResult &&
          toolResult.product &&
          toolResult.product.productId
        ) {
          candidateProductIds.add(toolResult.product.productId);
        }

        functionResponseParts.push({
          functionResponse: {
            name,
            response: toolResult,
          },
        });
      }

      currentPayload = functionResponseParts;
    }

    const verifiedProducts = await verifyRecommendedProducts(
      Array.from(candidateProductIds),
    );

    const fallbackObj = {
      message:
        "I was unable to complete this search within the allowed steps. Please try a more specific question.",
      products: verifiedProducts,
      toolsUsed,
    };

    logAIEvent("AI_RESPONSE", {
      productsCount: verifiedProducts.length,
      toolsUsedCount: toolsUsed.length,
      fallback: true,
    });

    return fallbackObj;
  } catch (err) {
    logAIEvent("AI_ERROR", { error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  processChat,
  verifyRecommendedProducts,
  logAIEvent,
  MAX_TOOL_ITERATIONS,
};
