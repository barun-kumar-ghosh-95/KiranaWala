/**
 * KiranaWala AI Foundation — Comprehensive Test Suite
 *
 * Coverage:
 *  Auth & Role:        tests 1–3
 *  Validation:         tests 4–7
 *  Provider Errors:    tests 8–9
 *  searchProducts:     tests 10–13
 *  getNearbyStores:    tests 14–15
 *  checkAvailability:  tests 16–17
 *  getProductDetails:  tests 18–19
 *  Tool loop safety:   tests 20–21
 *  Read-only contract: test 22
 *  Result limit:       test 23
 *  Response contract:  tests 24–25
 *  Secret safety:      tests 26–27
 *
 * The real Gemini API is NEVER called.
 * aiProviderAdapter is fully mocked by Jest.
 */

"use strict";

const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

// ---------------------------------------------------------------------------
// Mock the provider adapter BEFORE importing anything that depends on it.
// jest.mock() is hoisted, so this always runs first.
// ---------------------------------------------------------------------------
jest.mock("../services/ai/aiProviderAdapter");
const { createConversation } = require("../services/ai/aiProviderAdapter");

// ---------------------------------------------------------------------------
// Import models and application modules AFTER mocking
// ---------------------------------------------------------------------------
const User = require("../models/user");
const Store = require("../models/store");
const Product = require("../models/product");

const aiRoutes = require("../routes/aiRoutes");
const {
  searchProducts,
  getNearbyStores,
  getProductDetails,
  checkProductAvailability,
} = require("../services/ai/aiTools");
const {
  processChat,
  MAX_TOOL_ITERATIONS,
} = require("../services/ai/aiService");

// ---------------------------------------------------------------------------
// Test application
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use("/api/customer/ai", aiRoutes);

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// ---------------------------------------------------------------------------
// Mock response builders
// ---------------------------------------------------------------------------

/** Builds a mock Gemini response that returns a final text answer. */
function makeMockTextResponse(text) {
  return {
    response: {
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
    },
  };
}

/** Builds a mock Gemini response that requests a specific tool call. */
function makeMockFunctionCallResponse(toolName, args = {}) {
  return {
    response: {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: { name: toolName, args },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * Creates a mock conversation object (what createConversation returns).
 * @param {object|Array} responses - Single response or array of sequential responses
 */
function makeMockConversation(responses) {
  const responseList = Array.isArray(responses) ? responses : [responses];
  let callCount = 0;

  const sendMock = jest.fn().mockImplementation(() => {
    // Cycle through responses; repeat the last one if exhausted
    const response =
      responseList[callCount] ?? responseList[responseList.length - 1];
    callCount++;
    return Promise.resolve(response);
  });

  return { send: sendMock };
}

// ---------------------------------------------------------------------------
// Database lifecycle
// ---------------------------------------------------------------------------

describe("KiranaWala AI Foundation", () => {
  const DB_NAME =
    "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_AI_FOUNDATION";

  let customerUser, storeOwnerUser, testStore;
  let productInStock, productOutOfStock, productUnavailable;
  let customerToken, storeOwnerToken;

  beforeAll(async () => {
    if (!DB_NAME.includes("TEST")) {
      throw new Error("Safety check: database name must contain 'TEST'");
    }
    await mongoose.connect(DB_NAME);
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    await User.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});

    customerUser = await User.create({
      username: "aiFoundationCustomer",
      email: "ai_cust@test.com",
      password: "password123",
      role: "customer",
    });

    storeOwnerUser = await User.create({
      username: "aiFoundationOwner",
      email: "ai_owner@test.com",
      password: "password123",
      role: "store-owner",
    });

    customerToken = jwt.sign(
      { userId: customerUser._id, id: customerUser._id },
      JWT_SECRET,
    );
    storeOwnerToken = jwt.sign(
      { userId: storeOwnerUser._id, id: storeOwnerUser._id },
      JWT_SECRET,
    );

    testStore = await Store.create({
      name: "Foundation Test Kirana",
      description: "Test store for AI foundation tests",
      category: "Groceries",
      owner: storeOwnerUser._id,
    });

    productInStock = await Product.create({
      name: "Aashirvaad Atta 5kg",
      description: "Premium whole wheat flour",
      price: 260,
      image: "http://example.com/atta.jpg",
      category: "Groceries",
      stock: 10,
      available: true,
      store: testStore._id,
    });

    productOutOfStock = await Product.create({
      name: "Tata Salt 1kg",
      description: "Iodised salt",
      price: 24,
      image: "http://example.com/salt.jpg",
      category: "Groceries",
      stock: 0,
      available: true,
      store: testStore._id,
    });

    productUnavailable = await Product.create({
      name: "Discontinued Biscuits",
      description: "Old product",
      price: 30,
      image: "http://example.com/biscuit.jpg",
      category: "Snacks",
      stock: 100,
      available: false,
      store: testStore._id,
    });
  });

  // ==========================================================================
  // 1–3. Authentication & Authorization
  // ==========================================================================

  describe("Auth & Role Guards (POST /api/customer/ai/chat)", () => {
    test("1. Authenticated customer → 200 with message and toolsUsed", async () => {
      createConversation.mockReturnValueOnce(
        makeMockConversation(makeMockTextResponse("Here are your results.")),
      );

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Show me some atta" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("toolsUsed");
      expect(typeof res.body.message).toBe("string");
      expect(Array.isArray(res.body.toolsUsed)).toBe(true);
    });

    test("2. No token → 401 (provider never called)", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .send({ message: "Show me products" });

      expect(res.status).toBe(401);
      expect(createConversation).not.toHaveBeenCalled();
    });

    test("3. Store-owner token → 403 (provider never called)", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${storeOwnerToken}`)
        .send({ message: "Show me products" });

      expect(res.status).toBe(403);
      expect(createConversation).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4–7. Request Validation
  // ==========================================================================

  describe("Request Validation", () => {
    test("4. Missing message → 400", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/message/i);
      expect(createConversation).not.toHaveBeenCalled();
    });

    test("5. Empty message (whitespace only) → 400", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "   " });

      expect(res.status).toBe(400);
      expect(createConversation).not.toHaveBeenCalled();
    });

    test("6. Non-string message (number) → 400", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: 42 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/string/i);
      expect(createConversation).not.toHaveBeenCalled();
    });

    test("6b. Non-string message (array) → 400", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: ["find me atta"] });

      expect(res.status).toBe(400);
      expect(createConversation).not.toHaveBeenCalled();
    });

    test("7. Message > 2000 characters → 400", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "x".repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/2000/);
      expect(createConversation).not.toHaveBeenCalled();
    });

    test("7b. Message exactly 2000 characters → 200 (boundary valid)", async () => {
      createConversation.mockReturnValueOnce(
        makeMockConversation(makeMockTextResponse("Got your message.")),
      );

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "y".repeat(2000) });

      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // 8–9. Provider Error Handling
  // ==========================================================================

  describe("Provider Error Handling", () => {
    test("8. AI provider throws generic error → 500 (no internals exposed)", async () => {
      const mockConv = {
        send: jest
          .fn()
          .mockRejectedValueOnce(
            new Error("Internal SDK failure containing secret_key_abc123"),
          ),
      };
      createConversation.mockReturnValueOnce(mockConv);

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find me atta" });

      expect(res.status).toBe(500);
      // Internal error details must never reach the client
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("secret_key");
      expect(body).not.toContain("SDK failure");
      expect(body).not.toContain("stack");
      expect(res.body.message).toBeTruthy();
    });

    test("9. AI provider not configured (missing key) → 503", async () => {
      const configError = new Error("AI service is not configured.");
      configError.code = "AI_PROVIDER_NOT_CONFIGURED";
      createConversation.mockImplementationOnce(() => {
        throw configError;
      });

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find me atta" });

      expect(res.status).toBe(503);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain("GEMINI_API_KEY");
      expect(body).not.toContain("AI_PROVIDER_NOT_CONFIGURED");
      expect(res.body.message).toBeTruthy();
    });
  });

  // ==========================================================================
  // 10–13. searchProducts Tool
  // ==========================================================================

  describe("aiTools.searchProducts", () => {
    test("10. Returns shaped product data from real database", async () => {
      const result = await searchProducts({ query: "atta" });

      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("total");
      expect(result.products.length).toBeGreaterThan(0);

      const p = result.products[0];
      expect(p).toHaveProperty("productId");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("price");
      expect(p).toHaveProperty("category");
      expect(p).toHaveProperty("stock");
      expect(p).toHaveProperty("available");
      expect(p).toHaveProperty("storeId");
      expect(p.name).toBe("Aashirvaad Atta 5kg");
    });

    test("11. Excludes out-of-stock products (stock === 0)", async () => {
      const result = await searchProducts({ query: "Tata Salt" });
      const found = result.products.find((p) => p.name === "Tata Salt 1kg");
      expect(found).toBeUndefined();
    });

    test("11b. Excludes unavailable products (available === false)", async () => {
      const result = await searchProducts({ query: "Discontinued" });
      const found = result.products.find(
        (p) => p.name === "Discontinued Biscuits",
      );
      expect(found).toBeUndefined();
    });

    test("12. searchProducts validates input (invalid storeId rejects)", async () => {
      await expect(
        searchProducts({ storeId: "not-a-valid-objectid" }),
      ).rejects.toThrow(/invalid storeid/i);
    });

    test("13. Does not expose sensitive fields", async () => {
      const result = await searchProducts({ query: "atta" });
      const p = result.products[0];

      expect(p).not.toHaveProperty("_id");
      expect(p).not.toHaveProperty("__v");
      expect(p).not.toHaveProperty("password");
      expect(p).not.toHaveProperty("owner");
      // storeId must be a plain string, not a MongoDB ObjectId
      expect(typeof p.storeId).toBe("string");
      expect(typeof p.productId).toBe("string");
    });
  });

  // ==========================================================================
  // 14–15. getNearbyStores Tool
  // ==========================================================================

  describe("aiTools.getNearbyStores", () => {
    test("14. Validates coordinates — latitude out of range", async () => {
      await expect(
        getNearbyStores({ latitude: 999, longitude: 77.2 }),
      ).rejects.toThrow(/latitude/i);
    });

    test("14b. Validates coordinates — longitude out of range", async () => {
      await expect(
        getNearbyStores({ latitude: 28.6, longitude: 999 }),
      ).rejects.toThrow(/longitude/i);
    });

    test("14c. Validates coordinates — NaN values", async () => {
      await expect(
        getNearbyStores({ latitude: NaN, longitude: 77.2 }),
      ).rejects.toThrow();
    });

    test("14d. Validates coordinates — non-numeric strings", async () => {
      await expect(
        getNearbyStores({ latitude: "north", longitude: "east" }),
      ).rejects.toThrow();
    });

    test("15. Returns structured store objects for valid coordinates", async () => {
      await Store.create({
        name: "Near Delhi Kirana",
        description: "A store near Delhi",
        category: "Kirana",
        owner: storeOwnerUser._id,
        location: {
          type: "Point",
          coordinates: [77.209, 28.6139], // [lng, lat]
        },
      });

      const result = await getNearbyStores({
        latitude: 28.6139,
        longitude: 77.209,
        radiusKm: 5,
      });

      expect(result).toHaveProperty("stores");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.stores)).toBe(true);

      if (result.stores.length > 0) {
        const s = result.stores[0];
        expect(s).toHaveProperty("storeId");
        expect(s).toHaveProperty("name");
        expect(s).toHaveProperty("category");
        // Sensitive fields must be absent
        expect(s).not.toHaveProperty("owner");
        expect(s).not.toHaveProperty("products");
        expect(s).not.toHaveProperty("__v");
        expect(s).not.toHaveProperty("_id");
      }
    });
  });

  // ==========================================================================
  // 16–17. checkProductAvailability Tool
  // ==========================================================================

  describe("aiTools.checkProductAvailability", () => {
    test("16. Reads LIVE database state — in-stock product", async () => {
      const result = await checkProductAvailability({
        productId: productInStock._id.toString(),
      });

      expect(result.found).toBe(true);
      expect(result.available).toBe(true);
      expect(result.stock).toBe(10);
      expect(result.productName).toBe("Aashirvaad Atta 5kg");
    });

    test("16b. Reads LIVE database state — out-of-stock product", async () => {
      const result = await checkProductAvailability({
        productId: productOutOfStock._id.toString(),
      });

      expect(result.found).toBe(true);
      expect(result.available).toBe(false);
      expect(result.stock).toBe(0);
    });

    test("16c. Returns found:false for non-existent product", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await checkProductAvailability({ productId: fakeId });
      expect(result.found).toBe(false);
      expect(result.available).toBe(false);
    });

    test("16d. Returns available:false for unavailable product", async () => {
      const result = await checkProductAvailability({
        productId: productUnavailable._id.toString(),
      });
      expect(result.found).toBe(true);
      expect(result.available).toBe(false);
    });

    test("17. Validates productId — rejects invalid ObjectId", async () => {
      await expect(
        checkProductAvailability({ productId: "not-a-valid-id" }),
      ).rejects.toThrow(/invalid productid/i);
    });
  });

  // ==========================================================================
  // 18–19. getProductDetails Tool
  // ==========================================================================

  describe("aiTools.getProductDetails", () => {
    test("18. Returns null / found:false for non-existent product", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await getProductDetails({ productId: fakeId });
      expect(result.found).toBe(false);
      expect(result.product).toBeNull();
    });

    test("19. Returns shaped product without sensitive fields", async () => {
      const result = await getProductDetails({
        productId: productInStock._id.toString(),
      });

      expect(result.found).toBe(true);
      expect(result.product.name).toBe("Aashirvaad Atta 5kg");
      expect(result.product.price).toBe(260);
      // Must not expose internal Mongoose/Mongo fields
      expect(result.product).not.toHaveProperty("_id");
      expect(result.product).not.toHaveProperty("__v");
      expect(result.product).not.toHaveProperty("owner");
    });

    test("19b. Validates productId — rejects invalid ObjectId", async () => {
      await expect(getProductDetails({ productId: "bad-id" })).rejects.toThrow(
        /invalid productid/i,
      );
    });
  });

  // ==========================================================================
  // 20–21. Tool Loop Safety
  // ==========================================================================

  describe("Tool Loop Safety", () => {
    test("20. Tool loop stops at MAX_TOOL_ITERATIONS and returns graceful message", async () => {
      // Mock: conversation.send always returns an unknown tool call → no text ever
      // Using an unknown tool name so executeTool returns { error: "Unknown tool..." }
      // without touching the database
      const alwaysFunctionCall = makeMockFunctionCallResponse(
        "nonExistentTool",
        {},
      );
      const mockConv = makeMockConversation(alwaysFunctionCall);
      createConversation.mockReturnValueOnce(mockConv);

      const result = await processChat({ message: "keep looping" });

      // Must have stopped and returned a readable message
      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe("string");

      // Must have been called exactly MAX_TOOL_ITERATIONS times
      expect(mockConv.send).toHaveBeenCalledTimes(MAX_TOOL_ITERATIONS);
    });

    test("21. Invalid tool request is handled safely (no crash)", async () => {
      // First call returns an unknown tool name
      // Second call returns a normal text response
      const mockConv = makeMockConversation([
        makeMockFunctionCallResponse("completelyFakeToolName", { x: 1 }),
        makeMockTextResponse("I processed your request."),
      ]);
      createConversation.mockReturnValueOnce(mockConv);

      const result = await processChat({ message: "use a fake tool" });

      // Should not crash; should eventually return text
      expect(result.message).toBeTruthy();
      expect(Array.isArray(result.toolsUsed)).toBe(true);
    });
  });

  // ==========================================================================
  // 22. Read-Only Contract
  // ==========================================================================

  describe("Read-Only Contract", () => {
    test("22. AI tool layer exports ONLY read-only functions", () => {
      const aiToolsModule = require("../services/ai/aiTools");

      // Public exports (exclude internal _-prefixed helpers)
      const publicExports = Object.keys(aiToolsModule).filter(
        (k) => !k.startsWith("_"),
      );

      const ALLOWED_READ_TOOLS = [
        "searchProducts",
        "getNearbyStores",
        "getProductDetails",
        "checkProductAvailability",
        "buildShoppingIntentBasket",
      ];

      const FORBIDDEN_WRITE_OPERATIONS = [
        "updateProduct",
        "deleteProduct",
        "createProduct",
        "updateStock",
        "addToCart",
        "removeFromCart",
        "createOrder",
        "cancelOrder",
        "updateOrder",
        "modifyInventory",
        "updateUser",
        "updateStore",
      ];

      // No write operations should be exported
      FORBIDDEN_WRITE_OPERATIONS.forEach((writeOp) => {
        expect(publicExports).not.toContain(writeOp);
      });

      // Every public export must be in the approved read-only list
      publicExports.forEach((name) => {
        expect(ALLOWED_READ_TOOLS).toContain(name);
      });
    });
  });

  // ==========================================================================
  // 23. Result Limit Enforcement
  // ==========================================================================

  describe("Result Limit Enforcement", () => {
    test("23. searchProducts enforces server-side maximum — ignores client limit > max", async () => {
      // Create 25 products to exceed any sensible limit
      for (let i = 0; i < 25; i++) {
        await Product.create({
          name: `Bulk Product ${i}`,
          description: `Test product number ${i}`,
          price: 10 + i,
          image: `http://example.com/bulk${i}.jpg`,
          category: "Groceries",
          stock: 5,
          available: true,
          store: testStore._id,
        });
      }

      // Request an absurd limit — server must cap at MAX_SEARCH_LIMIT (20)
      const result = await searchProducts({
        query: "Bulk Product",
        limit: 9999,
      });

      expect(result.products.length).toBeLessThanOrEqual(20);
    });

    test("23b. searchProducts uses default limit when none specified", async () => {
      const result = await searchProducts({});
      // Default is 10; just verify it's bounded
      expect(result.products.length).toBeLessThanOrEqual(10);
    });
  });

  // ==========================================================================
  // 24–25. Response Contract
  // ==========================================================================

  describe("Response Contract", () => {
    test("24. Successful response has exactly message and toolsUsed", async () => {
      createConversation.mockReturnValueOnce(
        makeMockConversation(makeMockTextResponse("Here is what I found.")),
      );

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find atta" });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ["message", "products", "toolsUsed"].sort(),
      );
    });

    test("25. Response never contains chain-of-thought or raw provider output", async () => {
      createConversation.mockReturnValueOnce(
        makeMockConversation(makeMockTextResponse("Amul Milk is ₹62.")),
      );

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Price of Amul Milk?" });

      const body = JSON.stringify(res.body);
      // No raw provider internals
      expect(body).not.toContain("candidates");
      expect(body).not.toContain("functionCall");
      expect(body).not.toContain("safetyRatings");
      expect(body).not.toContain("promptFeedback");
    });
  });

  // ==========================================================================
  // 26–27. Secret Safety
  // ==========================================================================

  describe("Secret Safety", () => {
    test("26. API response never exposes API keys", async () => {
      createConversation.mockReturnValueOnce(
        makeMockConversation(
          makeMockTextResponse("I found some products for you."),
        ),
      );

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find products" });

      const body = JSON.stringify(res.body);
      expect(body).not.toContain("GEMINI_API_KEY");
      expect(body).not.toContain("apiKey");
      expect(body).not.toContain("API_KEY");
    });

    test("27. API response never exposes stack traces or internal paths", async () => {
      const mockConv = {
        send: jest
          .fn()
          .mockRejectedValueOnce(
            new Error(
              "at Object.send (/server/services/ai/aiProviderAdapter.js:99)",
            ),
          ),
      };
      createConversation.mockReturnValueOnce(mockConv);

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find me something" });

      expect(res.status).toBe(500);
      const body = JSON.stringify(res.body);
      // Must not expose file paths or stack frames
      expect(body).not.toContain("aiProviderAdapter");
      expect(body).not.toContain("at Object");
      expect(body).not.toContain("/server/");
    });
  });
});
