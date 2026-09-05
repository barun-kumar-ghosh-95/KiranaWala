const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const storeRoutes = require("../routes/storeRoutes");
const User = require("../models/user");
const Store = require("../models/store");

const app = express();
app.use(express.json());
app.use("/api/store", storeRoutes);

describe("Store Geospatial Foundation Tests", () => {
  beforeAll(async () => {
    const TEST_URI =
      "mongodb://127.0.0.1:27017/kiranawala_TEST_SAFE_TO_DROP_GEO";
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
  });

  const getBaseStore = (prefix) => ({
    username: `${prefix}user`,
    email: `${prefix}@example.com`,
    password: "password123",
    storeName: `${prefix} Store`,
    storeDescription: "A test store",
    storeCategory: "Grocery",
  });

  // 1. Missing location is handled gracefully (compatibility check)
  it("should successfully register a store without location data", async () => {
    const payload = getBaseStore("noloc");
    const res = await request(app).post("/api/store/register").send(payload);

    expect(res.statusCode).toBe(201);

    const store = await Store.findOne({ name: "noloc Store" });
    expect(store).toBeDefined();
    expect(store.location).toBeUndefined();
  });

  // 2. Valid coordinates are accepted & stored as [longitude, latitude]
  it("should accept valid coordinates and store them in [longitude, latitude] order", async () => {
    const payload = {
      ...getBaseStore("validloc"),
      latitude: 28.6139,
      longitude: 77.209,
    };
    const res = await request(app).post("/api/store/register").send(payload);

    expect(res.statusCode).toBe(201);

    const store = await Store.findOne({ name: "validloc Store" });
    expect(store).toBeDefined();
    expect(store.location).toBeDefined();
    expect(store.location.type).toBe("Point");
    // VERY IMPORTANT: GeoJSON is [longitude, latitude]
    expect(store.location.coordinates[0]).toBe(77.209);
    expect(store.location.coordinates[1]).toBe(28.6139);
  });

  // 3. Invalid latitude is rejected
  it("should reject registration if latitude is out of bounds", async () => {
    const payload = {
      ...getBaseStore("badlat"),
      latitude: 95.0, // Invalid lat (> 90)
      longitude: 77.209,
    };
    const res = await request(app).post("/api/store/register").send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid geographic coordinates");

    const user = await User.findOne({ email: payload.email });
    expect(user).toBeNull();
  });

  // 4. Invalid longitude is rejected
  it("should reject registration if longitude is out of bounds", async () => {
    const payload = {
      ...getBaseStore("badlng"),
      latitude: 28.6139,
      longitude: -200.0, // Invalid lng (< -180)
    };
    const res = await request(app).post("/api/store/register").send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid geographic coordinates");

    const user = await User.findOne({ email: payload.email });
    expect(user).toBeNull();
  });

  // 5. Partial coordinates are rejected
  it("should reject if only one coordinate is provided", async () => {
    const payload = {
      ...getBaseStore("partial"),
      latitude: 28.6139,
    };
    const res = await request(app).post("/api/store/register").send(payload);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Both latitude and longitude are required if providing location",
    );

    // Ensure User was NOT created
    const user = await User.findOne({ email: payload.email });
    expect(user).toBeNull();
  });

  // 6. Schema has the 2dsphere index
  it("should have a 2dsphere index on the location field", async () => {
    // We can check Mongoose indexes defined on the schema
    const indexes = Store.schema.indexes();
    const hasGeoIndex = indexes.some((index) => {
      const keys = index[0];
      return keys.location === "2dsphere";
    });
    expect(hasGeoIndex).toBe(true);
  });
});
