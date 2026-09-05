const mongoose = require("mongoose");
const request = require("supertest");
const express = require("express");
const Store = require("../models/store");
const User = require("../models/user");
const customerRoutes = require("../routes/customerRoutes");

const app = express();
app.use(express.json());
app.use("/api/customer", customerRoutes);

describe("Customer Nearby Stores API", () => {
  beforeAll(async () => {
    const mongoUri =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_NEARBY";
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

    // Create a mock owner
    const owner = new User({
      username: "testowner",
      email: "owner@test.com",
      password: "password123",
      role: "store-owner",
    });
    await owner.save();

    // Central point (e.g., Connaught Place, New Delhi: 28.6304° N, 77.2177° E)
    const stores = [
      {
        name: "Store 1 (Within 1km)",
        description: "Close store",
        category: "Grocery",
        owner: owner._id,
        location: {
          type: "Point",
          coordinates: [77.2177, 28.6304], // exactly at CP
        },
      },
      {
        name: "Store 2 (Within 5km)",
        description: "Medium distance",
        category: "Grocery",
        owner: owner._id,
        location: {
          type: "Point",
          coordinates: [77.2177, 28.6704], // ~4.4km North
        },
      },
      {
        name: "Store 3 (Outside 8km, ~10km)",
        description: "Far store",
        category: "Grocery",
        owner: owner._id,
        location: {
          type: "Point",
          coordinates: [77.2177, 28.7204], // ~10km North
        },
      },
      {
        name: "Store 4 (No location)",
        description: "No coordinates",
        category: "Grocery",
        owner: owner._id,
      },
    ];

    await Store.insertMany(stores);
    // ensure indexes are built
    await Store.syncIndexes();
  });

  const centerLat = 28.6304;
  const centerLng = 77.2177;

  it("Returns stores within the default 8 km radius", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].name).toBe("Store 1 (Within 1km)"); // nearest
    expect(res.body[1].name).toBe("Store 2 (Within 5km)");
  });

  it("Does not return stores outside 8 km", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}`,
    );
    const storeNames = res.body.map((s) => s.name);
    expect(storeNames).not.toContain("Store 3 (Outside 8km, ~10km)");
  });

  it("Returns stores ordered from nearest to farthest", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}`,
    );
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].distance).toBeLessThan(res.body[1].distance);
  });

  it("Returns calculated distance for each store", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}`,
    );
    expect(res.body[0]).toHaveProperty("distance");
    expect(typeof res.body[0].distance).toBe("number");
  });

  it("Custom radius works correctly", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}&radiusKm=15`,
    );
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    const storeNames = res.body.map((s) => s.name);
    expect(storeNames).toContain("Store 3 (Outside 8km, ~10km)");
  });

  it("Missing latitude returns 400", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?longitude=${centerLng}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Latitude and longitude are required");
  });

  it("Missing longitude returns 400", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Latitude and longitude are required");
  });

  it("Invalid latitude returns 400", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=91&longitude=${centerLng}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid geographic coordinates");
  });

  it("Invalid longitude returns 400", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=181`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid geographic coordinates");
  });

  it("Invalid/non-positive radius returns 400", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}&radiusKm=-5`,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid radius");
  });

  it("Stores without location do not break the endpoint and are not returned as nearby geospatial results", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}&radiusKm=100`,
    );
    const storeNames = res.body.map((s) => s.name);
    expect(storeNames).not.toContain("Store 4 (No location)");
  });

  it("Does not expose sensitive owner information (like password)", async () => {
    const res = await request(app).get(
      `/api/customer/stores/nearby?latitude=${centerLat}&longitude=${centerLng}`,
    );
    expect(res.status).toBe(200);
    expect(res.body[0].owner).toHaveProperty("username", "testowner");
    expect(res.body[0].owner).not.toHaveProperty("password");
  });
});
