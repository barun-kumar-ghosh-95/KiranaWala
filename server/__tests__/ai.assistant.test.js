/**
 * KiranaWala — Day 6 Part 2 Tests
 * Customer AI Shopping Assistant: Product Verification, Cart Integration, Security, and Error States.
 */

"use strict";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Store = require("../models/store");
const Product = require("../models/product");
const Cart = require("../models/cart");
const aiRoutes = require("../routes/aiRoutes");
const customerRoutes = require("../routes/customerRoutes");
const { createConversation } = require("../services/ai/aiProviderAdapter");
const { verifyRecommendedProducts } = require("../services/ai/aiService");

// Express Test App
const app = express();
app.use(express.json());
app.use("/api/customer/ai", aiRoutes);
app.use("/api/customer", customerRoutes);

// Mock the AI Provider Adapter so no real Gemini API calls are made
jest.mock("../services/ai/aiProviderAdapter", () => ({
  createConversation: jest.fn(),
}));

describe("Day 6 Part 2 — Customer AI Shopping Assistant", () => {
  const DB_NAME =
    "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_ASSISTANT";

  let customerToken;
  let customerUser;
  let storeOwnerToken;
  let storeOwnerUser;
  let store1;
  let store2;
  let product1;
  let product2;
  let outOfStockProduct;

  const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
  const ORIGINAL_ENV = process.env;

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = "mock_test_gemini_api_key_for_part2";

    if (!DB_NAME.includes("TEST")) {
      throw new Error("Safety check: database name must contain 'TEST'");
    }
    await mongoose.connect(DB_NAME);
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }

    // Clean up DB collections
    await User.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});
    await Cart.deleteMany({});

    // Create Test Customer User
    customerUser = await User.create({
      username: "ananya_sharma",
      email: "ananya@example.com",
      password: "password123",
      role: "customer",
    });
    customerToken = jwt.sign(
      {
        userId: customerUser._id.toString(),
        id: customerUser._id.toString(),
        role: "customer",
      },
      JWT_SECRET,
    );

    // Create Test Store Owner User
    storeOwnerUser = await User.create({
      username: "ramesh_kirana",
      email: "ramesh@example.com",
      password: "password123",
      role: "store-owner",
    });
    storeOwnerToken = jwt.sign(
      {
        userId: storeOwnerUser._id.toString(),
        id: storeOwnerUser._id.toString(),
        role: "store-owner",
      },
      JWT_SECRET,
    );

    // Create Store 1 & Products
    store1 = await Store.create({
      name: "Lakshmi Super Kirana",
      owner: storeOwnerUser._id,
      category: "Kirana & General",
      description: "Neighborhood Kirana",
      location: {
        type: "Point",
        coordinates: [77.5946, 12.9716],
      },
    });

    product1 = await Product.create({
      name: "Aashirvaad Whole Wheat Atta 5kg",
      price: 260,
      category: "Staples",
      description: "100% pure whole wheat flour",
      stock: 25,
      available: true,
      image: "/images/test-atta.jpg",
      store: store1._id,
    });

    product2 = await Product.create({
      name: "Nandini Toned Milk 1L",
      price: 42,
      category: "Dairy",
      description: "Pasteurised toned milk",
      stock: 50,
      available: true,
      image: "/images/test-milk.jpg",
      store: store1._id,
    });

    outOfStockProduct = await Product.create({
      name: "Amul Butter 500g",
      price: 275,
      category: "Dairy",
      description: "Pasteurised butter",
      stock: 0,
      available: true,
      image: "/images/test-butter.jpg",
      store: store1._id,
    });

    // Create Store 2 & Product
    store2 = await Store.create({
      name: "Ganesh Organic Spices",
      owner: storeOwnerUser._id,
      category: "Spices & Produce",
      description: "Fresh spices and pulses",
      location: {
        type: "Point",
        coordinates: [77.6, 12.98],
      },
    });
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await Cart.deleteMany({});
  });

  // Helper function to mock Gemini conversation responses
  function mockGeminiResponse(textParts = [], functionCallParts = []) {
    return {
      send: jest.fn().mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  ...textParts.map((t) => ({ text: t })),
                  ...functionCallParts.map((fc) => ({ functionCall: fc })),
                ],
              },
            },
          ],
        },
      }),
    };
  }

  // -------------------------------------------------------------------------
  // 1. Authorization & Role Checks
  // -------------------------------------------------------------------------
  describe("Authorization & Access Control", () => {
    test("1. Unauthenticated request is rejected (401)", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .send({ message: "I need breakfast items" });

      expect(res.status).toBe(401);
    });

    test("2. Store owner user is rejected (403)", async () => {
      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${storeOwnerToken}`)
        .send({ message: "I need breakfast items" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/customer role required/i);
    });

    test("3. Authenticated customer can access AI assistant (200)", async () => {
      createConversation.mockReturnValueOnce(
        mockGeminiResponse(["Here are some breakfast staples for you!"]),
      );

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "I need breakfast under ₹300" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("products");
      expect(res.body).toHaveProperty("toolsUsed");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Server-Side Product Verification Engine
  // -------------------------------------------------------------------------
  describe("Server-Side Product Verification", () => {
    test("4. Valid product ID returns verified MongoDB object", async () => {
      const verified = await verifyRecommendedProducts([
        product1._id.toString(),
        product2._id.toString(),
      ]);

      expect(verified.length).toBe(2);
      expect(verified[0]._id).toBe(product1._id.toString());
      expect(verified[0].name).toBe("Aashirvaad Whole Wheat Atta 5kg");
      expect(verified[0].price).toBe(260); // Live DB price
      expect(verified[0].stock).toBe(25); // Live DB stock
      expect(verified[0].store.name).toBe("Lakshmi Super Kirana");
      expect(verified[1]._id).toBe(product2._id.toString());
    });

    test("5. Invalid ObjectId format is rejected/discarded", async () => {
      const verified = await verifyRecommendedProducts(["not-a-valid-id-123"]);
      expect(verified).toEqual([]);
    });

    test("6. Nonexistent ObjectId is rejected/discarded", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const verified = await verifyRecommendedProducts([fakeId]);
      expect(verified).toEqual([]);
    });

    test("7. Out-of-stock product (stock=0) is rejected/discarded", async () => {
      const verified = await verifyRecommendedProducts([
        outOfStockProduct._id.toString(),
      ]);
      expect(verified).toEqual([]);
    });

    test("8. AI cannot fabricate prices or stock levels (DB is authoritative)", async () => {
      const verified = await verifyRecommendedProducts([
        product1._id.toString(),
      ]);

      expect(verified[0].price).toBe(260); // DB price, NOT any fake AI price
      expect(verified[0].stock).toBe(25); // DB stock, NOT any fake AI stock
    });
  });

  // -------------------------------------------------------------------------
  // 3. AI Chat Execution Flow with Tool Execution & Recommendation Verification
  // -------------------------------------------------------------------------
  describe("AI Recommendation Flow", () => {
    test("9. Tool execution populates verified products array", async () => {
      const mockConv = {
        send: jest
          .fn()
          .mockResolvedValueOnce({
            response: {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "searchProducts",
                          args: { query: "atta" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          })
          .mockResolvedValueOnce({
            response: {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: `Here is Aashirvaad Atta (${product1._id}) for your breakfast!`,
                      },
                    ],
                  },
                },
              ],
            },
          }),
      };

      createConversation.mockReturnValueOnce(mockConv);

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Search for atta" });

      expect(res.status).toBe(200);
      expect(res.body.toolsUsed).toContain("searchProducts");
      expect(res.body.products.length).toBeGreaterThanOrEqual(1);
      expect(res.body.products[0]._id).toBe(product1._id.toString());
      expect(res.body.products[0].price).toBe(260);
    });

    test("10. Empty search results returned gracefully", async () => {
      const mockConv = {
        send: jest.fn().mockResolvedValueOnce({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "Sorry, no products matching 'exotic dragonfruit' were found.",
                    },
                  ],
                },
              },
            ],
          },
        }),
      };

      createConversation.mockReturnValueOnce(mockConv);

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find exotic dragonfruit" });

      expect(res.status).toBe(200);
      expect(res.body.products).toEqual([]);
      expect(res.body.message).toMatch(/no products matching/i);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cart Integration & Constraints Verification
  // -------------------------------------------------------------------------
  describe("Cart API Integration & Single-Store Enforcement", () => {
    test("11. Recommended product can be added using standard POST /api/customer/cart/items", async () => {
      const res = await request(app)
        .post("/api/customer/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId: product1._id.toString(), quantity: 1 });

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].product._id).toBe(product1._id.toString());
      expect(res.body.total).toBe(260);
    });

    test("12. Single-store cart rule enforced (CROSS_STORE_CONFLICT)", async () => {
      await request(app)
        .post("/api/customer/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId: product1._id.toString(), quantity: 1 });

      const productStore2 = await Product.create({
        name: "Cardamom 100g",
        price: 180,
        category: "Spices",
        description: "Green cardamom",
        stock: 10,
        available: true,
        image: "/images/test-cardamom.jpg",
        store: store2._id,
      });

      const res = await request(app)
        .post("/api/customer/cart/items")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ productId: productStore2._id.toString(), quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("CROSS_STORE_CONFLICT");
      expect(res.body.message).toMatch(/contains items from another store/i);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Provider Failures & Error Handling
  // -------------------------------------------------------------------------
  describe("AI Provider Failures & Error States", () => {
    test("13. Provider unconfigured / missing API key returns 503", async () => {
      const err = new Error("AI provider API key not configured");
      err.code = "AI_PROVIDER_NOT_CONFIGURED";
      createConversation.mockImplementationOnce(() => {
        throw err;
      });

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find milk" });

      expect(res.status).toBe(503);
      expect(res.body.message).toMatch(/temporarily unavailable/i);
    });

    test("14. Internal provider error returns 500 without leaking stack traces", async () => {
      createConversation.mockImplementationOnce(() => {
        throw new Error("SDK network crash at /internal/path/key=SECRET_123");
      });

      const res = await request(app)
        .post("/api/customer/ai/chat")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ message: "Find milk" });

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/unexpected error/i);
      expect(JSON.stringify(res.body)).not.toMatch(/SECRET_123/);
      expect(JSON.stringify(res.body)).not.toMatch(/\/internal\/path/);
    });
  });
});
