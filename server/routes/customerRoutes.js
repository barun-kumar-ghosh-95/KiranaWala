const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Store = require("../models/store");
const Product = require("../models/product");
const Cart = require("../models/cart");
const Order = require("../models/order");
const { authenticateToken } = require("../middleware/authMiddleware");
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

    const secret = process.env.JWT_SECRET || "your_jwt_secret";
    const token = jwt.sign({ userId: user._id, id: user._id }, secret, {
      expiresIn: "1h",
    });
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

// =====================================================
// CART ENDPOINTS
// =====================================================

// GET /api/customer/cart
router.get("/cart", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("store", "name category description");

    if (!cart) {
      return res.json({ items: [], store: null, subtotal: 0, total: 0 });
    }

    let validItems = [];
    let subtotal = 0;
    let modified = false;

    for (const item of cart.items) {
      if (!item.product) {
        modified = true;
        continue;
      }
      const itemSubtotal = (item.product.price || 0) * item.quantity;
      subtotal += itemSubtotal;
      validItems.push({
        _id: item._id,
        product: {
          _id: item.product._id,
          name: item.product.name,
          price: item.product.price,
          description: item.product.description,
          image: item.product.image,
          category: item.product.category,
          stock: item.product.stock,
          available: item.product.available,
          store: item.product.store,
        },
        quantity: item.quantity,
        subtotal: itemSubtotal,
      });
    }

    if (modified) {
      cart.items = cart.items.filter((i) => i.product);
      if (cart.items.length === 0) {
        cart.store = null;
      }
      await cart.save();
    }

    res.json({
      _id: cart._id,
      store: cart.store,
      items: validItems,
      subtotal,
      deliveryFee: 0,
      total: subtotal,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customer/cart/items
router.post("/cart/items", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { productId, quantity } = req.body;

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty !== Number(quantity)) {
      return res
        .status(400)
        .json({ message: "Quantity must be a positive integer" });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.available === false || product.stock <= 0) {
      return res
        .status(400)
        .json({ message: "Product is currently out of stock." });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], store: product.store });
    }

    // Store consistency check (ONE ACTIVE STORE PER CART)
    if (
      cart.store &&
      cart.items.length > 0 &&
      cart.store.toString() !== product.store.toString()
    ) {
      return res.status(400).json({
        message:
          "Your cart contains items from another store. Clear your cart to shop from this store.",
        code: "CROSS_STORE_CONFLICT",
      });
    }

    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );
    const existingQty =
      existingIndex > -1 ? cart.items[existingIndex].quantity : 0;
    const newQty = existingQty + parsedQty;

    if (newQty > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} units are available.`,
        availableStock: product.stock,
      });
    }

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity = newQty;
    } else {
      cart.items.push({ product: productId, quantity: parsedQty });
    }

    cart.store = product.store;
    await cart.save();

    await cart.populate("items.product");
    await cart.populate("store", "name category description");

    let subtotal = 0;
    const formattedItems = cart.items.map((i) => {
      const itemSub = (i.product ? i.product.price : 0) * i.quantity;
      subtotal += itemSub;
      return {
        _id: i._id,
        product: i.product,
        quantity: i.quantity,
        subtotal: itemSub,
      };
    });

    res.status(200).json({
      _id: cart._id,
      store: cart.store,
      items: formattedItems,
      subtotal,
      total: subtotal,
      message: "Item added to cart",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/customer/cart/items/:productId
router.patch("/cart/items/:productId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { productId } = req.params;
    const { quantity } = req.body;

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty !== Number(quantity)) {
      return res
        .status(400)
        .json({ message: "Quantity must be a positive integer" });
    }

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (i) => i.product.toString() === productId,
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not in cart" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product no longer exists" });
    }

    if (parsedQty > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} units are available.`,
        availableStock: product.stock,
      });
    }

    cart.items[itemIndex].quantity = parsedQty;
    await cart.save();

    await cart.populate("items.product");
    await cart.populate("store", "name category description");

    let subtotal = 0;
    const formattedItems = cart.items.map((i) => {
      const itemSub = (i.product ? i.product.price : 0) * i.quantity;
      subtotal += itemSub;
      return {
        _id: i._id,
        product: i.product,
        quantity: i.quantity,
        subtotal: itemSub,
      };
    });

    res.json({
      _id: cart._id,
      store: cart.store,
      items: formattedItems,
      subtotal,
      total: subtotal,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/customer/cart/items/:productId
router.delete("/cart/items/:productId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    if (cart.items.length === 0) {
      cart.store = null;
    }
    await cart.save();

    res.json({ message: "Item removed from cart", cart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/customer/cart
router.delete("/cart", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    let cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      cart.store = null;
      await cart.save();
    }
    res.json({ message: "Cart cleared successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// ORDER / CHECKOUT ENDPOINTS
// =====================================================

// POST /api/customer/orders
router.post("/orders", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { deliveryAddress } = req.body;

    if (
      !deliveryAddress ||
      !deliveryAddress.fullName ||
      !deliveryAddress.phone ||
      !deliveryAddress.address
    ) {
      return res.status(400).json({
        message: "Full name, phone number, and delivery address are required",
      });
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
      return res
        .status(400)
        .json({ message: "Cannot place order with an empty cart" });
    }

    let subtotal = 0;
    const orderItems = [];

    // Server authoritative recalculation and stock check
    for (const item of cart.items) {
      if (!item.product) {
        return res.status(400).json({
          message: "One or more items in your cart no longer exist",
        });
      }

      const product = await Product.findById(item.product._id);
      if (!product) {
        return res.status(400).json({
          message: `Product "${item.product.name}" no longer exists`,
        });
      }

      if (product.available === false) {
        return res.status(400).json({
          message: `Product "${product.name}" is currently unavailable`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available stock: ${product.stock}, requested: ${item.quantity}`,
        });
      }

      const unitPrice = product.price;
      const itemSubtotal = unitPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        product: product._id,
        productNameSnapshot: product.name,
        unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
      });
    }

    const deliveryFee = 0;
    const total = subtotal + deliveryFee;

    // Atomically update stock for each product
    for (const item of orderItems) {
      const updated = await Product.updateOne(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
      );
      if (updated.modifiedCount === 0) {
        return res.status(400).json({
          message: `Stock conflict: Insufficient stock for product ID ${item.product}`,
        });
      }
    }

    const order = new Order({
      customer: userId,
      store: cart.store,
      items: orderItems,
      deliveryAddress: {
        fullName: deliveryAddress.fullName.trim(),
        phone: deliveryAddress.phone.trim(),
        address: deliveryAddress.address.trim(),
        city: (deliveryAddress.city || "").trim(),
        pincode: (deliveryAddress.pincode || "").trim(),
      },
      subtotal,
      deliveryFee,
      total,
      status: "placed",
    });

    await order.save();

    // Clear cart after successful order creation
    cart.items = [];
    cart.store = null;
    await cart.save();

    await order.populate("store", "name category description");

    res.status(201).json({
      message: "Order placed successfully",
      order: {
        _id: order._id,
        store: order.store,
        items: order.items,
        deliveryAddress: order.deliveryAddress,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/orders
router.get("/orders", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const orders = await Order.find({ customer: userId })
      .sort({ createdAt: -1 })
      .populate("store", "name category");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/customer/orders/:orderId
router.get("/orders/:orderId", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { orderId } = req.params;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findOne({
      _id: orderId,
      customer: userId,
    }).populate("store", "name category description");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/customer/orders/:orderId/cancel
router.patch("/orders/:orderId/cancel", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { orderId } = req.params;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    // Atomic update: only transition status if it is currently 'placed'
    const order = await Order.findOneAndUpdate(
      { _id: orderId, customer: userId, status: "placed" },
      { $set: { status: "cancelled" } },
      { new: true },
    );

    if (!order) {
      const existingOrder = await Order.findOne({
        _id: orderId,
        customer: userId,
      });
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }
      return res.status(400).json({
        message: `Order cannot be cancelled in its current status: ${existingOrder.status}`,
      });
    }

    // Idempotent stock restoration (guaranteed to execute once)
    for (const item of order.items) {
      if (item.product) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
        );
      }
    }

    await order.populate("store", "name category description");

    res.json({
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
