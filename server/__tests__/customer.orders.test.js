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

describe("Customer Order History & Management API", () => {
  let customer1, customer2, store1, product1, product2;
  let token1, token2;
  const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

  beforeAll(async () => {
    const mongoUri =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_ORDERS";
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

    const uid = Math.random().toString(36).substring(2, 8);

    customer1 = await User.create({
      username: `orderCustomer1_${uid}`,
      email: `order1_${uid}@test.com`,
      password: "password123",
      role: "customer",
    });

    customer2 = await User.create({
      username: `orderCustomer2_${uid}`,
      email: `order2_${uid}@test.com`,
      password: "password123",
      role: "customer",
    });

    token1 = jwt.sign({ userId: customer1._id, id: customer1._id }, JWT_SECRET);
    token2 = jwt.sign({ userId: customer2._id, id: customer2._id }, JWT_SECRET);

    const owner = await User.create({
      username: `ordersOwner_${uid}`,
      email: `ordersOwner_${uid}@test.com`,
      password: "password123",
      role: "store-owner",
    });

    store1 = await Store.create({
      name: "Fresh Kirana Bazaar",
      description: "Organic groceries store",
      category: "Groceries",
      owner: owner._id,
    });

    product1 = await Product.create({
      name: "Tata Salt 1kg",
      description: "Iodized salt",
      price: 28,
      image: "http://example.com/salt.jpg",
      category: "Groceries",
      stock: 50,
      available: true,
      store: store1._id,
    });

    product2 = await Product.create({
      name: "Fortune Sugar 1kg",
      description: "Refined sugar",
      price: 48,
      image: "http://example.com/sugar.jpg",
      category: "Groceries",
      stock: 30,
      available: true,
      store: store1._id,
    });
  });

  test("1. Authenticated customer can retrieve orders", async () => {
    await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 2,
          subtotal: 56,
        },
      ],
      deliveryAddress: {
        fullName: "Test Customer",
        phone: "9876543210",
        address: "123 Main St",
      },
      subtotal: 56,
      total: 56,
      status: "placed",
    });

    const res = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].total).toBe(56);
  });

  test("2. Unauthenticated customer cannot retrieve orders", async () => {
    const res = await request(app).get("/api/customer/orders");
    expect(res.status).toBe(401);
  });

  test("3. Customer only sees own orders", async () => {
    await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "Address 1",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    await Order.create({
      customer: customer2._id,
      store: store1._id,
      items: [
        {
          product: product2._id,
          productNameSnapshot: product2.name,
          unitPrice: 48,
          quantity: 1,
          subtotal: 48,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 2",
        phone: "9123456789",
        address: "Address 2",
      },
      subtotal: 48,
      total: 48,
      status: "placed",
    });

    const res1 = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`);

    expect(res1.status).toBe(200);
    expect(res1.body).toHaveLength(1);
    expect(res1.body[0].total).toBe(28);

    const res2 = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${token2}`);

    expect(res2.status).toBe(200);
    expect(res2.body).toHaveLength(1);
    expect(res2.body[0].total).toBe(48);
  });

  test("4. Customer cannot access another customer's order", async () => {
    const order1 = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "Address 1",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order1._id}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/order not found/i);
  });

  test("5. Invalid order ID handled correctly", async () => {
    const res = await request(app)
      .get("/api/customer/orders/invalid-mongo-id-999")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid order id/i);
  });

  test("6. Missing order handled correctly", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/customer/orders/${fakeId}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/order not found/i);
  });

  test("7. Orders sorted by date descending", async () => {
    const orderOld = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "Address 1",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
      createdAt: new Date("2026-09-01T10:00:00Z"),
    });

    const orderNew = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product2._id,
          productNameSnapshot: product2.name,
          unitPrice: 48,
          quantity: 1,
          subtotal: 48,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "Address 1",
      },
      subtotal: 48,
      total: 48,
      status: "placed",
      createdAt: new Date("2026-09-05T10:00:00Z"),
    });

    const res = await request(app)
      .get("/api/customer/orders")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]._id.toString()).toBe(orderNew._id.toString());
    expect(res.body[1]._id.toString()).toBe(orderOld._id.toString());
  });

  test("8. Authenticated customer can retrieve own order details", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 2,
          subtotal: 56,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 Street",
      },
      subtotal: 56,
      total: 56,
      status: "placed",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(order._id.toString());
  });

  test("9. Unauthorized order access rejected", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 Street",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });

  test("10. Historical price snapshot returned", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28, // Historical snapshot price
          quantity: 2,
          subtotal: 56,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 Street",
      },
      subtotal: 56,
      total: 56,
      status: "placed",
    });

    // Update live product price
    product1.price = 50;
    await product1.save();

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0].unitPrice).toBe(28); // Preserves historical price 28, not 50
  });

  test("11. Historical product name snapshot returned", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: "Tata Salt Original Edition 1kg",
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 Street",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    // Delete product document from DB
    await Product.findByIdAndDelete(product1._id);

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0].productNameSnapshot).toBe(
      "Tata Salt Original Edition 1kg",
    );
  });

  test("12. Delivery address returned", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Rajesh Kumar",
        phone: "9988776655",
        address: "Flat 402, Sunshine Apartments",
        city: "Delhi",
        pincode: "110001",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.deliveryAddress.fullName).toBe("Rajesh Kumar");
    expect(res.body.deliveryAddress.city).toBe("Delhi");
  });

  test("13. Subtotal returned", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 2,
          subtotal: 56,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 56,
      total: 56,
      status: "placed",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.subtotal).toBe(56);
  });

  test("14. Total returned", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28,
      deliveryFee: 0,
      total: 28,
      status: "placed",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(28);
  });

  test("15. Status returned", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28,
      total: 28,
      status: "processing",
    });

    const res = await request(app)
      .get(`/api/customer/orders/${order._id}`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("processing");
  });

  test("16. Customer can cancel eligible order", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 2,
          subtotal: 56,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 56,
      total: 56,
      status: "placed",
    });

    const res = await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("cancelled");
  });

  test("17. Customer cannot cancel processing order", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28,
      total: 28,
      status: "processing",
    });

    const res = await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be cancelled/i);
  });

  test("18. Customer cannot cancel completed order", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28,
      total: 28,
      status: "completed",
    });

    const res = await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be cancelled/i);
  });

  test("19. Customer cannot cancel another customer's order", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    const res = await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/order not found/i);
  });

  test("20. Cancellation cannot be repeated (idempotent state control)", async () => {
    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: 1,
          subtotal: 28,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28,
      total: 28,
      status: "placed",
    });

    // First cancel call succeeds
    const res1 = await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);
    expect(res1.status).toBe(200);

    // Second cancel call is rejected safely
    const res2 = await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res2.status).toBe(400);
    expect(res2.body.message).toMatch(
      /cannot be cancelled in its current status: cancelled/i,
    );
  });

  test("21. Stock is restored exactly once upon order cancellation", async () => {
    const initialStock = product1.stock; // 50
    const cancelQty = 4;

    const order = await Order.create({
      customer: customer1._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: product1.name,
          unitPrice: 28,
          quantity: cancelQty,
          subtotal: 28 * cancelQty,
        },
      ],
      deliveryAddress: {
        fullName: "Customer 1",
        phone: "9876543210",
        address: "123 St",
      },
      subtotal: 28 * cancelQty,
      total: 28 * cancelQty,
      status: "placed",
    });

    // First cancellation restores stock once
    await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);

    let updatedProduct = await Product.findById(product1._id);
    expect(updatedProduct.stock).toBe(initialStock + cancelQty); // 50 + 4 = 54

    // Second cancellation attempt should fail and NOT restore stock again
    await request(app)
      .patch(`/api/customer/orders/${order._id}/cancel`)
      .set("Authorization", `Bearer ${token1}`);

    updatedProduct = await Product.findById(product1._id);
    expect(updatedProduct.stock).toBe(initialStock + cancelQty); // Remains 54 (no double restoration)
  });
});
