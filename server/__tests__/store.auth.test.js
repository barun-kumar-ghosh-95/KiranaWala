const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const storeRoutes = require("../routes/storeRoutes");
const customerRoutes = require("../routes/customerRoutes");
const User = require("../models/user");
const Store = require("../models/store");
const Product = require("../models/product");

const app = express();
app.use(express.json());
app.use("/api/store", storeRoutes);
app.use("/api/customer", customerRoutes);

describe("Store Authentication & Authorization Tests", () => {
  let storeOwnerUserA;
  let storeA;
  let productA;
  let tokenA;

  let storeOwnerUserB;
  let storeB;
  let productB;

  let customerUser;
  let customerToken;

  beforeAll(async () => {
    // Connect to in-memory db or real local db for tests if necessary.
    // Assuming standard jest mongodb setup is available or we connect directly
    process.env.JWT_SECRET = "test-secret";
    const TEST_URI = "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP";
    await mongoose.connect(TEST_URI, {
      serverSelectionTimeoutMS: 5000,
    });
  });

  afterAll(async () => {
    if (
      mongoose.connection.name &&
      !mongoose.connection.name.includes("TEST")
    ) {
      throw new Error("Safety abort: Attempting to drop a non-test database!");
    }
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});

    // Setup Store Owner A
    storeOwnerUserA = await User.create({
      username: "ownerA",
      email: "ownerA@test.com",
      password: "password123",
      role: "store-owner",
    });
    storeA = await Store.create({
      name: "Store A",
      description: "Desc A",
      category: "Cat A",
      owner: storeOwnerUserA._id,
    });
    tokenA = jwt.sign({ id: storeOwnerUserA._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Setup Store Owner B
    storeOwnerUserB = await User.create({
      username: "ownerB",
      email: "ownerB@test.com",
      password: "password123",
      role: "store-owner",
    });
    storeB = await Store.create({
      name: "Store B",
      description: "Desc B",
      category: "Cat B",
      owner: storeOwnerUserB._id,
    });

    // Setup Customer
    customerUser = await User.create({
      username: "customer",
      email: "customer@test.com",
      password: "password123",
      role: "customer",
    });
    customerToken = jwt.sign({ id: customerUser._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Setup Product for Store A
    productA = await Product.create({
      name: "Product A",
      price: 10,
      description: "Desc A",
      image: "imgA.png",
      store: storeA._id,
    });
    await Store.findByIdAndUpdate(storeA._id, {
      $push: { products: productA._id },
    });

    // Setup Product for Store B
    productB = await Product.create({
      name: "Product B",
      price: 20,
      description: "Desc B",
      image: "imgB.png",
      store: storeB._id,
    });
    await Store.findByIdAndUpdate(storeB._id, {
      $push: { products: productB._id },
    });
  });

  // 1. Missing JWT -> 401
  it("should return 401 if JWT is missing", async () => {
    const res = await request(app).post("/api/store/products").send({
      name: "New Product",
      price: 15,
      description: "Desc",
      image: "img.png",
      storeId: storeA._id,
    });

    expect(res.statusCode).toBe(401);
  });

  // 2. Invalid JWT -> 403
  it("should return 403 if JWT is invalid", async () => {
    const res = await request(app)
      .post("/api/store/products")
      .set("Authorization", "Bearer invalidtoken")
      .send({
        name: "New Product",
        price: 15,
        description: "Desc",
        image: "img.png",
        storeId: storeA._id,
      });

    expect(res.statusCode).toBe(403);
  });

  // 3. Expired JWT -> 403
  it("should return 403 if JWT is expired", async () => {
    const expiredToken = jwt.sign(
      { id: storeOwnerUserA._id },
      process.env.JWT_SECRET,
      { expiresIn: "-1h" },
    );
    const res = await request(app)
      .post("/api/store/products")
      .set("Authorization", `Bearer ${expiredToken}`)
      .send({
        name: "New Product",
        price: 15,
        description: "Desc",
        image: "img.png",
        storeId: storeA._id,
      });

    expect(res.statusCode).toBe(403);
  });

  // 4. Valid customer JWT attempting store-owner product management -> rejected
  it("should return 403 if customer attempts store-owner operations", async () => {
    const res = await request(app)
      .post("/api/store/products")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        name: "New Product",
        price: 15,
        description: "Desc",
        image: "img.png",
        storeId: storeA._id,
      });

    expect(res.statusCode).toBe(403);
  });

  // 5. Valid store-owner JWT for Store A attempting to add to Store B -> 403
  it("should return 403 if Owner A tries to add product to Store B", async () => {
    const res = await request(app)
      .post("/api/store/products")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        name: "New Product",
        price: 15,
        description: "Desc",
        image: "img.png",
        storeId: storeB._id,
      });

    expect(res.statusCode).toBe(403);
  });

  // 6. Store owner updating their own product -> allowed
  it("should allow Owner A to update their own product", async () => {
    const res = await request(app)
      .put(`/api/store/products/${productA._id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Updated Product A" });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("Updated Product A");
  });

  // 7. Store owner attempting to update another owner's product -> 403
  it("should return 403 if Owner A tries to update Product B", async () => {
    const res = await request(app)
      .put(`/api/store/products/${productB._id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Hacked Product B" });

    expect(res.statusCode).toBe(403);
  });

  // 8. Store owner deleting their own product -> allowed
  it("should allow Owner A to delete their own product", async () => {
    const res = await request(app)
      .delete(`/api/store/products/${productA._id}/${storeA._id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
  });

  // 9. Store owner attempting to delete another owner's product -> 403
  it("should return 403 if Owner A tries to delete Product B", async () => {
    const res = await request(app)
      .delete(`/api/store/products/${productB._id}/${storeB._id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(403);
  });

  // 10. Non-existent product -> 404
  it("should return 404 when updating non-existent product", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/store/products/${fakeId}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Ghost Product" });

    expect(res.statusCode).toBe(404);
  });

  // 11. Customer product/store browsing -> still works
  it("should allow public access to GET all stores", async () => {
    const res = await request(app).get("/api/store/all");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // 12. Tamper with store ID
  it("should ignore store field tampering during product update", async () => {
    const res = await request(app)
      .put(`/api/store/products/${productA._id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Hacked Store Product", store: storeB._id.toString() });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("Hacked Store Product");
    expect(res.body.store.toString()).not.toBe(storeB._id.toString());

    const dbProduct = await Product.findById(productA._id);
    expect(dbProduct.store.toString()).toBe(storeA._id.toString());
  });
});
