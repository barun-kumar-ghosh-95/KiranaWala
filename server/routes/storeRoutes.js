const express = require("express");
const router = express.Router();
const Store = require("../models/store");
const User = require("../models/user");
const Product = require("../models/product");
const jwt = require("jsonwebtoken");
const {
  authenticateToken,
  requireStoreOwner,
} = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

// Register store owner
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      storeName,
      storeDescription,
      storeCategory,
      latitude,
      longitude,
    } = req.body;

    if (
      !username ||
      !email ||
      !password ||
      !storeName ||
      !storeDescription ||
      !storeCategory
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    let locationData = undefined;
    if (latitude !== undefined || longitude !== undefined) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          message:
            "Both latitude and longitude are required if providing location",
        });
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
      locationData = {
        type: "Point",
        coordinates: [lng, lat],
      };
    }

    // Create the store-owner user. Password hashing is handled by the
    // User model's pre-save hook.
    const user = new User({
      username,
      email,
      password,
      role: "store-owner",
    });
    await user.save();

    // Create the store document owned by this user.
    const store = new Store({
      name: storeName,
      description: storeDescription,
      category: storeCategory,
      owner: user._id,
      ...(locationData && { location: locationData }),
    });
    await store.save();

    res.status(201).json({ message: "Registration successful" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login store owner
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the store-owner user
    const user = await User.findOne({ email, role: "store-owner" });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Find the store owned by this user
    const store = await Store.findOne({ owner: user._id });
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, storeId: store._id });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

// Add product route
router.post(
  "/products",
  authenticateToken,
  requireStoreOwner,
  async (req, res) => {
    try {
      const { name, price, description, image, storeId } = req.body;

      // Validate required fields
      if (!name || !price || !description || !image || !storeId) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (!mongoose.Types.ObjectId.isValid(storeId)) {
        return res.status(400).json({ message: "Invalid store ID" });
      }

      // Verify ownership
      const store = await Store.findById(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (store.owner.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Access denied: You do not own this store" });
      }

      // Create and save the product
      const product = new Product({
        name,
        price,
        description,
        image,
        store: storeId,
      });

      const savedProduct = await product.save();

      // Update store's products array
      await Store.findByIdAndUpdate(
        storeId,
        { $push: { products: savedProduct._id } },
        { new: true },
      );

      res.status(201).json(savedProduct);
    } catch (error) {
      console.error("Add product error:", error);
      res
        .status(500)
        .json({ message: "Failed to add product", error: error.message });
    }
  },
);

// Get all products for a store
router.get("/products/:storeId", async (req, res) => {
  try {
    const products = await Product.find({ store: req.params.storeId });
    res.json(products);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching products", error: error.message });
  }
});

// Update a product
router.put(
  "/products/:productId",
  authenticateToken,
  requireStoreOwner,
  async (req, res) => {
    try {
      const { productId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const store = await Store.findById(product.store);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (store.owner.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Access denied: You do not own this product" });
      }

      const { name, price, description, image } = req.body;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = price;
      if (description !== undefined) updateData.description = description;
      if (image !== undefined) updateData.image = image;

      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true },
      );
      res.json(updatedProduct);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating product", error: error.message });
    }
  },
);

// Delete a product
router.delete(
  "/products/:productId/:storeId",
  authenticateToken,
  requireStoreOwner,
  async (req, res) => {
    try {
      const { productId, storeId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(productId) ||
        !mongoose.Types.ObjectId.isValid(storeId)
      ) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.store.toString() !== storeId) {
        return res
          .status(400)
          .json({ message: "Product does not belong to the specified store" });
      }

      const store = await Store.findById(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (store.owner.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Access denied: You do not own this store" });
      }

      // Remove product from store's products array
      await Store.findByIdAndUpdate(storeId, {
        $pull: { products: productId },
      });

      // Delete the product
      await Product.findByIdAndDelete(productId);

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error deleting product", error: error.message });
    }
  },
);

// Get all stores (for customer dashboard)
router.get("/all", async (req, res) => {
  try {
    const stores = await Store.find().populate("owner", "username email");
    const result = stores.map((store) => ({
      _id: store._id,
      username: store.owner ? store.owner.username : undefined,
      email: store.owner ? store.owner.email : undefined,
      store: {
        name: store.name,
        description: store.description,
        category: store.category,
      },
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all products for a store (alternate path used by the products page)
router.get("/:storeId/products", async (req, res) => {
  try {
    const products = await Product.find({ store: req.params.storeId });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
