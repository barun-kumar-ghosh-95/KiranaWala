const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const Store = require("../models/store");
const User = require("../models/user");
const Product = require("../models/product");
const Cart = require("../models/cart");
const Order = require("../models/order");
const customerRoutes = require("../routes/customerRoutes");

const app = express();
app.use(express.json());
app.use("/api/customer", customerRoutes);

describe("Customer Order / Checkout API", () => {
  let customer1, customer2, store1, product1, product2;
  let token1, token2;
  const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

  beforeAll(async () => {
    const mongoUri =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_CHECKOUT";
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
    await Order.deleteMany({});

    customer1 = await User.create({
      username: "checkoutCustomer1",
      email: "chk1@test.com",
      password: "password123",
      role: "customer",
    });

    customer2 = await User.create({
      username: "checkoutCustomer2",
      email: "chk2@test.com",
      password: "password123",
      role: "customer",
    });

    token1 = jwt.sign({ userId: customer1._id, id: customer1._id }, JWT_SECRET);
    token2 = jwt.sign({ userId: customer2._id, id: customer2._id }, JWT_SECRET);

    const owner = await User.create({
      username: "checkoutOwner",
      email: "chkOwner@test.com",
      password: "password123",
      role: "store-owner",
    });

    store1 = await Store.create({
      name: "Super Kirana Store",
      description: "Fast delivery kirana",
      category: "Groceries",
      owner: owner._id,
    });

    product1 = await Product.create({
      name: "Aashirvaad Atta 5kg",
      description: "Whole wheat flour",
      price: 260,
      image: "http://example.com/atta.jpg",
      category: "Groceries",
      stock: 10,
      available: true,
      store: store1._id,
    });

    product2 = await Product.create({
      name: "Amul Butter 100g",
      description: "Pasteurised butter",
      price: 56,
      image: "http://example.com/butter.jpg",
      category: "Dairy",
      stock: 5,
      available: true,
      store: store1._id,
    });
  });

  test("15. Reject unauthenticated order creation", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .send({
        deliveryAddress: {
          fullName: "Test User",
          phone: "9876543210",
          address: "123 Street",
        },
      });
    expect(res.status).toBe(401);
  });

  test("16. Reject empty cart order creation", async () => {
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Test User",
          phone: "9876543210",
          address: "123 Street",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty cart/i);
  });

  test("17. Reject invalid delivery data", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "",
          phone: "",
          address: "",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  test("18. Reject deleted product in cart during checkout", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    // Delete product
    await Product.findByIdAndDelete(product1._id);

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Test User",
          phone: "9876543210",
          address: "123 Street",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer exist/i);
  });

  test("19. Reject unavailable product during checkout", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    product1.available = false;
    await product1.save();

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Test User",
          phone: "9876543210",
          address: "123 Street",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/currently unavailable/i);
  });

  test("20. Reject insufficient stock during checkout", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product2._id, quantity: 5 });

    // Reduce stock in DB behind the scenes
    product2.stock = 3;
    await product2.save();

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Test User",
          phone: "9876543210",
          address: "123 Street",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

  test("21. Recalculate price server-side regardless of client tampering", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 2 });

    // Attempt to pass malicious price/total in request body
    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Hacker User",
          phone: "9876543210",
          address: "123 Dark Street",
        },
        unitPrice: 1, // Tampered price
        total: 2, // Tampered total
      });

    expect(res.status).toBe(201);
    expect(res.body.order.subtotal).toBe(520); // 260 * 2
    expect(res.body.order.total).toBe(520);
  });

  test("22. Correct subtotal calculation", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product2._id, quantity: 2 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Rahul Verma",
          phone: "9876543210",
          address: "456 Park View",
        },
      });

    expect(res.status).toBe(201);
    // 260*1 + 56*2 = 260 + 112 = 372
    expect(res.body.order.subtotal).toBe(372);
  });

  test("23. Correct total calculation", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Rahul Verma",
          phone: "9876543210",
          address: "456 Park View",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.order.total).toBe(260);
  });

  test("24. Successful order creation creates Order record in DB", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Anita Roy",
          phone: "9123456789",
          address: "789 Lake View",
        },
      });

    expect(res.status).toBe(201);
    const orderInDb = await Order.findById(res.body.order._id);
    expect(orderInDb).not.toBeNull();
    expect(orderInDb.status).toBe("placed");
  });

  test("25. Save product price snapshot in Order item", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Anita Roy",
          phone: "9123456789",
          address: "789 Lake View",
        },
      });

    expect(res.body.order.items[0].unitPrice).toBe(260);

    // Update product price afterwards
    product1.price = 300;
    await product1.save();

    const orderInDb = await Order.findById(res.body.order._id);
    expect(orderInDb.items[0].unitPrice).toBe(260); // Historical snapshot intact
  });

  test("26. Save product name snapshot in Order item", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Anita Roy",
          phone: "9123456789",
          address: "789 Lake View",
        },
      });

    expect(res.body.order.items[0].productNameSnapshot).toBe(
      "Aashirvaad Atta 5kg",
    );
  });

  test("27. Reduce product stock after successful order placement", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 3 });

    await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Anita Roy",
          phone: "9123456789",
          address: "789 Lake View",
        },
      });

    const updatedProduct = await Product.findById(product1._id);
    expect(updatedProduct.stock).toBe(7); // 10 - 3 = 7
  });

  test("28. Clear cart after successful order placement", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 2 });

    await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Anita Roy",
          phone: "9123456789",
          address: "789 Lake View",
        },
      });

    const cartRes = await request(app)
      .get("/api/customer/cart")
      .set("Authorization", `Bearer ${token1}`);

    expect(cartRes.body.items).toHaveLength(0);
  });

  test("29. Prevent malicious client-provided total", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product2._id, quantity: 2 }); // 56 * 2 = 112

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Bad Actor",
          phone: "9999999999",
          address: "Fake St",
        },
        total: 10, // Attempt 10 INR
      });

    expect(res.status).toBe(201);
    expect(res.body.order.total).toBe(112);
  });

  test("30. Prevent malicious client-provided price", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const res = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Bad Actor",
          phone: "9999999999",
          address: "Fake St",
        },
        items: [{ product: product1._id, unitPrice: 0.01 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.items[0].unitPrice).toBe(260);
  });

  test("31. Verify customer ownership of created order", async () => {
    await request(app)
      .post("/api/customer/cart/items")
      .set("Authorization", `Bearer ${token1}`)
      .send({ productId: product1._id, quantity: 1 });

    const orderRes = await request(app)
      .post("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`)
      .send({
        deliveryAddress: {
          fullName: "Customer 1",
          phone: "9876543210",
          address: "123 Address",
        },
      });

    const orderId = orderRes.body.order._id;

    // Customer 2 attempts to fetch Customer 1's order
    const resForbidden = await request(app)
      .get(`/api/customer/orders/${orderId}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(resForbidden.status).toBe(404); // Returns not found to avoid leaking order existence

    // Customer 1 fetches their own order
    const resSuccess = await request(app)
      .get(`/api/customer/orders/${orderId}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body._id).toBe(orderId);
  });
});
