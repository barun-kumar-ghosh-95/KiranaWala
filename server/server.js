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

if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI is missing from server/.env");
} else {
  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    })
    .then(() => {
      console.log("Connected to MongoDB successfully");
    })
    .catch((err) => {
      console.error("MongoDB connection failed:");
      console.error(err.message);
    });
}

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
app.use("/api/store", storeRoutes);

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
