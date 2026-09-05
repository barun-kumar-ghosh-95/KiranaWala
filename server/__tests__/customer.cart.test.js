const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const Store = require("../models/store");
const User = require("../models/user");
const Product = require("../models/product");
const Cart = require("../models/cart");
const customerRoutes = require("../routes/customerRoutes");

const app = express();
app.use(express.json());
app.use("/api/customer", customerRoutes);

describe("Customer Cart API", () => {
  let customer1, customer2, store1, store2, product1, product2, productStore2;
  let token1, token2;
  const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

  beforeAll(async () => {
    const mongoUri =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_CART";
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
    await Cart.deleteMany({});

    customer1 = await User.create({
      username: "cartCustomer1",
      email: "cart1@test.com",
      password: "password123",
      role: "customer",
    });

    customer2 = await User.create({
      username: "cartCustomer2",
      email: "cart2@test.com",
      password: "password123",
      role: "customer",
    });

    token1 = jwt.sign({ userId: customer1._id, id: customer1._id }, JWT_SECRET);
    token2 = jwt.sign({ userId: customer2._id, id: customer2._id }, JWT_SECRET);

    const owner = await User.create({
      username: "storeOwnerCart",
      email: "ownerCart@test.com",
      password: "password123",
      role: "store-owner",
    });

    store1 = await Store.create({
      name: "Cart Store 1",
      description: "First grocery store",
      category: "Groceries",
      owner: owner._id,
    });

    store2 = await Store.create({
      name: "Cart Store 2",
      description: "Second grocery store",
      category: "Snacks",
      owner: owner._id,
    });

    product1 = await Product.create({
      name: "Fortune Sunflower Oil 1L",
      description: "Edible oil",
      price: 150,
      image: "http://example.com/oil.jpg",
      category: "Groceries",
      stock: 10,
      available: true,
      store: store1._id,
    });

    product2 = await Product.create({
      name: "Basmati Rice 1kg",
      description: "Long grain rice",
      price: 90,
      image: "http://example.com/rice.jpg",
      category: "Groceries",
      stock: 5,
      available: true,
      store: store1._id,
    });

    productStore2 = await Product.create({
      name: "Potato Chips 50g",
      description: "Crispy snacks",
      price: 20,
      image: "http://example.com/chips.jpg",
      category: "Snacks",
      stock: 20,
      available: true,
      store: store2._id,
    });
  });

  test("1. Authenticated customer can get cart", async () => {
    const res = await request(app)
      .get("/api/customer/cart")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test("2. Unauthenticated customer cannot get cart", async () => {
    const res = await request(app).get("/api/customer/cart");
    expect(res.status).toBe(401);
  });

  test("3. Customer cannot access another customer's cart", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 2 });

    const res2 = await request(app)
      .get("/api/customer/cart")
      .set("Authorization", `Bearer ${token2}`);

    expect(res2.status).toBe(200);
    expect(res2.body.items).toHaveLength(0);
  });

  test("4. Add valid product to cart", async () => {
    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(2);
    expect(res.body.subtotal).toBe(300);
  });

  test("5. Add invalid product ID returns 400", async () => {
    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: "invalid-id-123", quantity: 1 });

    expect(res.status).toBe(400);
  });

  test("6. Add out-of-stock product returns 400", async () => {
    const outOfStockProd = await Product.create({
      name: "Out of Stock Milk",
      description: "Fresh milk",
      price: 30,
      image: "http://example.com/milk.jpg",
      category: "Dairy",
      stock: 0,
      available: true,
      store: store1._id,
    });

    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: outOfStockProd._id, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/out of stock/i);
  });

  test("7. Add quantity above stock returns 400", async () => {
    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product2._id, quantity: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/only 5 units are available/i);
  });

  test("8. Reject zero quantity", async () => {
    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/positive integer/i);
  });

  test("9. Reject negative quantity", async () => {
    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: -3 });

    expect(res.status).toBe(400);
  });

  test("10. Reject decimal quantity", async () => {
    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1.5 });

    expect(res.status).toBe(400);
  });

  test("11. Update item quantity", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .patch(`/api/customer/cart/items/${product1._id}`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.items[0].quantity).toBe(4);
    expect(res.body.subtotal).toBe(600);
  });

  test("12. Remove single item from cart", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 2 });

    const res = await request(app)
      .delete(`/api/customer/cart/items/${product1._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get("/api/customer/cart")
      .set("Authorization", `Bearer ${token1}`);

    expect(getRes.body.items).toHaveLength(0);
  });

  test("13. Clear cart", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 2 });

    const res = await request(app)
      .delete("/api/customer/cart")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get("/api/customer/cart")
      .set("Authorization", `Bearer ${token1}`);

    expect(getRes.body.items).toHaveLength(0);
  });

  test("14. Prevent cross-store cart mixing", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: productStore2._id, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CROSS_STORE_CONFLICT");
    expect(res.body.message).toMatch(/items from another store/i);
  });
});
