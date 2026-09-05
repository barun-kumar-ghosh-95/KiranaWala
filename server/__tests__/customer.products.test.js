const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const Store = require("../models/store");
const User = require("../models/user");
const Product = require("../models/product");
const customerRoutes = require("../routes/customerRoutes");

const app = express();
app.use(express.json());
app.use("/api/customer", customerRoutes);

describe("Customer Product Discovery API", () => {
  let owner1, store1, store2, product1, product2;

  beforeAll(async () => {
    const mongoUri =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_PRODUCTS";
    if (!mongoUri.includes("TEST")) {
      throw new Error("Safety check: Database name must contain TEST");
    }
    await mongoose.connect(mongoUri);
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Store.deleteMany({});
    await User.deleteMany({});
    await Product.deleteMany({});

    owner1 = await User.create({
      username: "owner1",
      email: "owner1@test.com",
      password: "password123",
      role: "store-owner",
    });

    store1 = await Store.create({
      name: "Fresh Kirana Store",
      description: "Local grocery store",
      category: "Groceries",
      owner: owner1._id,
    });

    store2 = await Store.create({
      name: "Empty Store",
      description: "A store without products yet",
      category: "General",
      owner: owner1._id,
    });

    product1 = await Product.create({
      name: "Basmati Rice 5kg",
      description: "Premium long grain rice",
      price: 450,
      image: "http://example.com/rice.jpg",
      category: "Groceries",
      stock: 15,
      available: true,
      store: store1._id,
    });

    product2 = await Product.create({
      name: "Full Cream Milk 1L",
      description: "Fresh dairy milk",
      price: 66,
      image: "http://example.com/milk.jpg",
      category: "Dairy",
      stock: 5,
      available: true,
      store: store1._id,
    });
  });

  test("1. Fetch products for a valid store returns 200 and store context", async () => {
    const res = await request(app).get(
      `/api/customer/stores/${store1._id}/products`,
    );
    expect(res.status).toBe(200);
    expect(res.body.store).toBeDefined();
    expect(res.body.store.name).toBe("Fresh Kirana Store");
    expect(res.body.products).toHaveLength(2);
  });

  test("2. Returns products belonging ONLY to that store", async () => {
    const res = await request(app).get(
      `/api/customer/stores/${store1._id}/products`,
    );
    expect(res.status).toBe(200);
    const productIds = res.body.products.map((p) => p._id);
    expect(productIds).toContain(product1._id.toString());
    expect(productIds).toContain(product2._id.toString());
  });

  test("3. Store with no products returns empty array of products", async () => {
    const res = await request(app).get(
      `/api/customer/stores/${store2._id}/products`,
    );
    expect(res.status).toBe(200);
    expect(res.body.store.name).toBe("Empty Store");
    expect(res.body.products).toHaveLength(0);
  });

  test("4. Invalid store ID returns 400 Bad Request", async () => {
    const res = await request(app).get(
      "/api/customer/stores/invalid-store-id-123/products",
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid store id/i);
  });

  test("5. Non-existent valid ObjectId store returns 404 Not Found", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(
      `/api/customer/stores/${fakeId}/products`,
    );
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/store not found/i);
  });

  test("6. Sensitive owner/user information is not exposed", async () => {
    const res = await request(app).get(
      `/api/customer/stores/${store1._id}/products`,
    );
    expect(res.status).toBe(200);
    expect(res.body.store.password).toBeUndefined();
    expect(res.body.store.owner).toBeUndefined();
  });
});
