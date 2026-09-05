const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Store = require("../models/store");
const Product = require("../models/product");
const mongoose = require("mongoose");

// Customer Registration
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: "customer",
    });

    await user.save();
    res.status(201).json({ message: "Customer registered successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: "customer" });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, "your_jwt_secret");
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get nearby stores
router.get("/stores/nearby", async (req, res) => {
  try {
    const { latitude, longitude, radiusKm } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res
        .status(400)
        .json({ message: "Invalid geographic coordinates" });
    }

    const radius = radiusKm !== undefined ? parseFloat(radiusKm) : 8;
    if (isNaN(radius) || radius <= 0) {
      return res.status(400).json({ message: "Invalid radius" });
    }

    const maxDistanceMeters = radius * 1000;

    const stores = await Store.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [lng, lat],
          },
          distanceField: "distance",
          maxDistance: maxDistanceMeters,
          spherical: true,
        },
      },
    ]);

    // Populate owner details excluding password
    await Store.populate(stores, { path: "owner", select: "-password" });

    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all stores (for customer dashboard)
router.get("/stores", async (req, res) => {
  try {
    const stores = await Store.find().populate("owner", "username");
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get products for a specific store (Customer Product Discovery)
router.get("/stores/:storeId/products", async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "Invalid store ID" });
    }

    const store = await Store.findById(storeId).select(
      "name description category owner location",
    );

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const products = await Product.find({ store: storeId });

    res.json({
      store: {
        _id: store._id,
        name: store.name,
        category: store.category,
        description: store.description,
      },
      products,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
