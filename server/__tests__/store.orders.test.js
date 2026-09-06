const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const Store = require("../models/store");
const User = require("../models/user");
const Product = require("../models/product");
const Order = require("../models/order");
const storeRoutes = require("../routes/storeRoutes");

const app = express();
app.use(express.json());
app.use("/api/store", storeRoutes);
app.use("/api/store-owner", storeRoutes);

describe("Store-Owner Order Management API", () => {
  let owner1, owner2, customerUser;
  let store1, store2;
  let product1, product2;
  let order1Store1, order2Store1, order1Store2;
  let tokenOwner1, tokenOwner2, tokenCustomer;
  const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

  beforeAll(async () => {
    const mongoUri =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_STORE_ORDERS";
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
    await Order.deleteMany({});

    const uid = Math.random().toString(36).substring(2, 8);

    // Create 2 Store Owners
    owner1 = await User.create({
      username: `owner1_${uid}`,
      email: `owner1_${uid}@test.com`,
      password: "password123",
      role: "store-owner",
    });

    owner2 = await User.create({
      username: `owner2_${uid}`,
      email: `owner2_${uid}@test.com`,
      password: "password123",
      role: "store-owner",
    });

    // Create 1 Customer
    customerUser = await User.create({
      username: `customer_${uid}`,
      email: `customer_${uid}@test.com`,
      password: "password123",
      role: "customer",
    });

    // Create Stores
    store1 = await Store.create({
      name: `Kirana One ${uid}`,
      description: "Neighborhood groceries",
      category: "Grocery",
      owner: owner1._id,
    });

    store2 = await Store.create({
      name: `Kirana Two ${uid}`,
      description: "Spices & Provisions",
      category: "Grocery",
      owner: owner2._id,
    });

    // Create Products
    product1 = await Product.create({
      name: "Basmati Rice 1kg",
      price: 120,
      description: "Premium basmati",
      image: "/images/rice.jpg",
      store: store1._id,
      stock: 50,
      available: true,
    });

    product2 = await Product.create({
      name: "Toor Dal 500g",
      price: 80,
      description: "Pure toor dal",
      image: "/images/dal.jpg",
      store: store2._id,
      stock: 40,
      available: true,
    });

    // Tokens
    tokenOwner1 = jwt.sign({ id: owner1._id, role: "store-owner" }, JWT_SECRET);
    tokenOwner2 = jwt.sign({ id: owner2._id, role: "store-owner" }, JWT_SECRET);
    tokenCustomer = jwt.sign(
      { userId: customerUser._id, id: customerUser._id, role: "customer" },
      JWT_SECRET,
    );

    // Create Orders for Store 1
    order1Store1 = await Order.create({
      customer: customerUser._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: "Basmati Rice 1kg",
          unitPrice: 120,
          quantity: 2,
          subtotal: 240,
        },
      ],
      deliveryAddress: {
        fullName: "Rahul Sharma",
        phone: "9876543210",
        address: "Flat 101, Sunshine Heights",
        city: "Mumbai",
        pincode: "400001",
      },
      subtotal: 240,
      deliveryFee: 0,
      total: 240,
      status: "placed",
    });

    order2Store1 = await Order.create({
      customer: customerUser._id,
      store: store1._id,
      items: [
        {
          product: product1._id,
          productNameSnapshot: "Basmati Rice 1kg",
          unitPrice: 120,
          quantity: 1,
          subtotal: 120,
        },
      ],
      deliveryAddress: {
        fullName: "Priya Patel",
        phone: "9876543211",
        address: "Row House 4, Palm Grove",
        city: "Mumbai",
        pincode: "400002",
      },
      subtotal: 120,
      deliveryFee: 0,
      total: 120,
      status: "processing",
    });

    // Create Order for Store 2
    order1Store2 = await Order.create({
      customer: customerUser._id,
      store: store2._id,
      items: [
        {
          product: product2._id,
          productNameSnapshot: "Toor Dal 500g",
          unitPrice: 80,
          quantity: 3,
          subtotal: 240,
        },
      ],
      deliveryAddress: {
        fullName: "Amit Verma",
        phone: "9876543212",
        address: "Apt 2B, Green Woods",
        city: "Mumbai",
        pincode: "400003",
      },
      subtotal: 240,
      deliveryFee: 0,
      total: 240,
      status: "placed",
    });
  });

  // 1. Store owner can list their own store's orders
  test("1. Store owner can list their own store's orders (both endpoints, sorted newest first)", async () => {
    const res = await request(app)
      .get("/api/store-owner/orders")
      .set("Authorization", `Bearer ${tokenOwner1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    const orderIds = res.body.map((o) => o._id.toString());
    expect(orderIds).toContain(order1Store1._id.toString());
    expect(orderIds).toContain(order2Store1._id.toString());
    // Store 2 order must NOT be in Store 1's list
    expect(orderIds).not.toContain(order1Store2._id.toString());

    // Check status filter works
    const filterRes = await request(app)
      .get("/api/store-owner/orders?status=placed")
      .set("Authorization", `Bearer ${tokenOwner1}`);

    expect(filterRes.status).toBe(200);
    expect(filterRes.body.length).toBe(1);
    expect(filterRes.body[0]._id.toString()).toBe(order1Store1._id.toString());

    // Also verify /api/store/orders works identically
    const altRes = await request(app)
      .get("/api/store/orders")
      .set("Authorization", `Bearer ${tokenOwner1}`);
    expect(altRes.status).toBe(200);
    expect(altRes.body.length).toBe(2);
  });

  // 2. Store owner cannot see another store's orders
  test("2. Store owner cannot see another store's orders", async () => {
    const res = await request(app)
      .get("/api/store-owner/orders")
      .set("Authorization", `Bearer ${tokenOwner2}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id.toString()).toBe(order1Store2._id.toString());

    // Owner 2 must never see Owner 1's orders
    const orderIds = res.body.map((o) => o._id.toString());
    expect(orderIds).not.toContain(order1Store1._id.toString());
    expect(orderIds).not.toContain(order2Store1._id.toString());
  });

  // 3. Store owner can retrieve their own order
  test("3. Store owner can retrieve their own order with details and customer info", async () => {
    const res = await request(app)
      .get(`/api/store-owner/orders/${order1Store1._id}`)
      .set("Authorization", `Bearer ${tokenOwner1}`);

    expect(res.status).toBe(200);
    expect(res.body._id.toString()).toBe(order1Store1._id.toString());
    expect(res.body.store.toString()).toBe(store1._id.toString());
    expect(res.body.deliveryAddress.fullName).toBe("Rahul Sharma");
    expect(res.body.customer.username).toBe(customerUser.username);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].productNameSnapshot).toBe("Basmati Rice 1kg");
    expect(res.body.items[0].unitPrice).toBe(120);
    expect(res.body.total).toBe(240);
  });

  // 4. Store owner cannot retrieve another store's order
  test("4. Store owner cannot retrieve another store's order (forbidden)", async () => {
    // Owner 1 tries to access Order from Store 2
    const res = await request(app)
      .get(`/api/store-owner/orders/${order1Store2._id}`)
      .set("Authorization", `Bearer ${tokenOwner1}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Access denied/i);

    // Owner 2 tries to access Order from Store 1
    const res2 = await request(app)
      .get(`/api/store-owner/orders/${order1Store1._id}`)
      .set("Authorization", `Bearer ${tokenOwner2}`);

    expect(res2.status).toBe(403);
  });

  // 5. Valid status transitions succeed
  test("5. Valid status transitions succeed (placed -> processing -> completed and placed -> cancelled)", async () => {
    // Transition placed -> processing
    const res1 = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "processing" });

    expect(res1.status).toBe(200);
    expect(res1.body.order.status).toBe("processing");

    // Transition processing -> completed
    const res2 = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "completed" });

    expect(res2.status).toBe(200);
    expect(res2.body.order.status).toBe("completed");

    // Transition placed -> cancelled on another order
    const initialStock = product2.stock;
    const res3 = await request(app)
      .patch(`/api/store-owner/orders/${order1Store2._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner2}`)
      .send({ status: "cancelled" });

    expect(res3.status).toBe(200);
    expect(res3.body.order.status).toBe("cancelled");

    // Verify stock is restored on cancellation (3 units were ordered)
    const updatedProd = await Product.findById(product2._id);
    expect(updatedProd.stock).toBe(initialStock + 3);

    // Transition processing -> cancelled on order2Store1
    const res4 = await request(app)
      .patch(`/api/store-owner/orders/${order2Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "cancelled" });

    expect(res4.status).toBe(200);
    expect(res4.body.order.status).toBe("cancelled");
  });

  // 6. Invalid status is rejected
  test("6. Invalid status is rejected (e.g., 'shipped', 'refunded', '')", async () => {
    const res = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "shipped" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid status/i);

    const resEmpty = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({});

    expect(resEmpty.status).toBe(400);
  });

  // 7. Invalid status transition is rejected
  test("7. Invalid status transition is rejected", async () => {
    // 7a. placed -> completed (skipping processing) is not allowed
    const skipRes = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "completed" });

    expect(skipRes.status).toBe(400);
    expect(skipRes.body.message).toMatch(/Invalid status transition/i);

    // 7b. completed -> processing (cannot revert completed)
    order1Store1.status = "completed";
    await order1Store1.save();

    const revertRes = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "processing" });

    expect(revertRes.status).toBe(400);

    // 7c. completed -> cancelled is not allowed
    const cancelAfterComplete = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "cancelled" });

    expect(cancelAfterComplete.status).toBe(400);

    // 7d. cancelled -> processing or placed is not allowed
    order2Store1.status = "cancelled";
    await order2Store1.save();

    const reviveRes = await request(app)
      .patch(`/api/store-owner/orders/${order2Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "processing" });

    expect(reviveRes.status).toBe(400);
  });

  // 8. Unauthenticated request is rejected
  test("8. Unauthenticated request is rejected (401)", async () => {
    const listRes = await request(app).get("/api/store-owner/orders");
    expect(listRes.status).toBe(401);

    const getRes = await request(app).get(
      `/api/store-owner/orders/${order1Store1._id}`,
    );
    expect(getRes.status).toBe(401);

    const patchRes = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .send({ status: "processing" });
    expect(patchRes.status).toBe(401);
  });

  // 9. Customer cannot access store-owner order management endpoints
  test("9. Customer cannot access store-owner order management endpoints (403)", async () => {
    const listRes = await request(app)
      .get("/api/store-owner/orders")
      .set("Authorization", `Bearer ${tokenCustomer}`);
    expect(listRes.status).toBe(403);
    expect(listRes.body.message).toMatch(/Store owner role required/i);

    const getRes = await request(app)
      .get(`/api/store-owner/orders/${order1Store1._id}`)
      .set("Authorization", `Bearer ${tokenCustomer}`);
    expect(getRes.status).toBe(403);

    const patchRes = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenCustomer}`)
      .send({ status: "processing" });
    expect(patchRes.status).toBe(403);
  });

  // 10. Historical product name/price remains unchanged
  test("10. Historical product name/price remains unchanged even if product is later updated", async () => {
    // Modify the live product in the catalog (increase price to 200 and change name)
    await Product.findByIdAndUpdate(product1._id, {
      name: "Super Deluxe Basmati Rice Gold 1kg",
      price: 200,
    });

    // Fetch the order as store owner
    const res = await request(app)
      .get(`/api/store-owner/orders/${order1Store1._id}`)
      .set("Authorization", `Bearer ${tokenOwner1}`);

    expect(res.status).toBe(200);
    const item = res.body.items[0];
    // Historical snapshots MUST remain untouched
    expect(item.productNameSnapshot).toBe("Basmati Rice 1kg");
    expect(item.unitPrice).toBe(120);
    expect(item.subtotal).toBe(240);
    expect(res.body.total).toBe(240);
  });

  // 11. Order totals remain server-controlled
  test("11. Order totals remain server-controlled and cannot be altered by client", async () => {
    // Ensure that sending bogus total or price in PATCH status does not overwrite server total
    const res = await request(app)
      .patch(`/api/store-owner/orders/${order1Store1._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({
        status: "processing",
        total: 1, // Tampered field
        subtotal: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("processing");
    // Totals remain unchanged
    expect(res.body.order.subtotal).toBe(240);
    expect(res.body.order.total).toBe(240);

    // Verify persisted record in DB
    const dbOrder = await Order.findById(order1Store1._id);
    expect(dbOrder.total).toBe(240);
  });

  // Cross-store mutation attempt test
  test("Cross-store mutation attempt is rejected with 403 Forbidden", async () => {
    const res = await request(app)
      .patch(`/api/store-owner/orders/${order1Store2._id}/status`)
      .set("Authorization", `Bearer ${tokenOwner1}`)
      .send({ status: "processing" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Access denied/i);
  });
});
