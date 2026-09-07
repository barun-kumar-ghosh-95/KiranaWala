const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Load environment variables from server/.env
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

const customerRoutes = require("./routes/customerRoutes");
const storeRoutes = require("./routes/storeRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());

// Serve public files
app.use(express.static(path.join(__dirname, "../public")));

// Serve views
app.use(express.static(path.join(__dirname, "../views")));

// =====================================================
// MONGODB CONNECTION
// =====================================================

const connectMongo = async () => {
  const primaryUri = process.env.MONGO_URI;
  const isProduction = process.env.NODE_ENV === "production";
  const localUri = "mongodb://127.0.0.1:27017/kiranawala";

  if (!primaryUri) {
    if (isProduction) {
      console.error("FATAL: MONGO_URI is missing in production environment.");
      return;
    }
    console.warn(
      "MONGO_URI not specified. Using local MongoDB for development...",
    );
  } else {
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: isProduction ? 8000 : 3000,
      });
      console.log("Connected to MongoDB successfully");
      return;
    } catch (err) {
      console.error("Primary MongoDB connection failed:", err.message);
      if (isProduction) {
        console.error(
          "FATAL: Production database connection failed. Local fallback is disabled in production.",
        );
        return;
      }
      console.warn("Falling back to local MongoDB for development...");
    }
  }

  // Local MongoDB fallback is strictly allowed only in non-production environments
  if (!isProduction) {
    try {
      await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
      console.log("Connected to local MongoDB successfully");
    } catch (err) {
      console.error("Local MongoDB connection failed:", err.message);
    }
  }
};

connectMongo();

// MongoDB connection status
mongoose.connection.on("connected", () => {
  console.log("Mongoose connection established");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("Mongoose reconnected");
});

// =====================================================
// API ROUTES
// =====================================================

app.use("/api/customer", customerRoutes);
app.use("/api/customer/ai", aiRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/store-owner", storeRoutes);

// =====================================================
// PAGE ROUTES
// =====================================================

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/index.html"));
});

// Customer login
app.get("/customer/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/login.html"));
});

// Customer register
app.get("/customer/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/register.html"));
});

// Customer dashboard
app.get("/customer/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/dashboard.html"));
});

// Customer products
app.get("/customer/products", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/products.html"));
});

// Customer cart
app.get("/customer/cart", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/cart.html"));
});

// Customer checkout
app.get("/customer/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/checkout.html"));
});

// Customer orders history
app.get("/customer/orders", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/orders.html"));
});

// Customer order details
app.get("/customer/orders/:orderId", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/customer/order.html"));
});

// Store owner login
app.get("/store-owner/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/store-owner/login.html"));
});

// Store owner register
app.get("/store-owner/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/store-owner/register.html"));
});

// Store owner dashboard
app.get("/store-owner/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/store-owner/dashboard.html"));
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "KiranaWala server is running",
  });
});

// MongoDB health check
app.get("/health/db", (req, res) => {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const state = mongoose.connection.readyState;

  res.json({
    database: states[state] || "unknown",
    connected: state === 1,
  });
});

// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
