/**
 * KiranaWala AI — Tool Layer
 *
 * These are the ONLY database operations the AI is permitted to invoke.
 *
 * Design constraints:
 *  - ALL tools are READ-ONLY. No writes, updates, or deletions.
 *  - Every tool validates its inputs before touching the database.
 *  - DB projections explicitly exclude sensitive / unnecessary fields.
 *  - The AI never receives raw MongoDB documents — only shaped, safe objects.
 *  - Tools never trust arbitrary client-provided data without validation.
 */

"use strict";

const mongoose = require("mongoose");
const Product = require("../../models/product");
const Store = require("../../models/store");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of products a single search can return. */
const MAX_SEARCH_LIMIT = 20;

/** Default search result limit when none is specified. */
const DEFAULT_SEARCH_LIMIT = 10;

/** Maximum geospatial search radius in kilometres. */
const MAX_RADIUS_KM = 50;

/** Default search radius in kilometres. */
const DEFAULT_RADIUS_KM = 8;

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Validates a MongoDB ObjectId string.
 * @param {string} id
 * @returns {boolean}
 */
function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

/**
 * Validates geographic coordinates.
 * @param {number} lat
 * @param {number} lng
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateCoordinates(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { valid: false, reason: "Latitude and longitude must be numbers" };
  }
  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, reason: "Latitude and longitude must not be NaN" };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, reason: "Latitude must be between -90 and 90" };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, reason: "Longitude must be between -180 and 180" };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Safe Data Shapers
// These functions strip any fields that should never reach the AI layer.
// ---------------------------------------------------------------------------

/**
 * Projects a Product document into a safe, AI-consumable object.
 * Deliberately omits: __v, internal store ref (replaced with storeId string),
 * createdAt, updatedAt (not useful for shopping decisions).
 * @param {object} doc - Mongoose product document or plain object
 * @returns {object}
 */
function shapeProduct(doc) {
  return {
    productId: doc._id ? doc._id.toString() : doc.id,
    name: doc.name,
    price: doc.price,
    category: doc.category || "General",
    description: doc.description,
    stock: doc.stock,
    available: doc.available !== false, // treat undefined as available
    storeId: doc.store ? doc.store.toString() : null,
  };
}

/**
 * Projects a Store document into a safe, AI-consumable object.
 * Deliberately omits: owner (user ref), products array, __v, internal IDs.
 * @param {object} doc - Mongoose store document or plain object
 * @param {number} [distanceMeters] - Optional distance from $geoNear aggregation
 * @returns {object}
 */
function shapeStore(doc, distanceMeters) {
  const shaped = {
    storeId: doc._id ? doc._id.toString() : doc.id,
    name: doc.name,
    description: doc.description,
    category: doc.category,
  };

  // Include distance only when provided by geospatial query
  if (typeof distanceMeters === "number" && !isNaN(distanceMeters)) {
    shaped.distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
  }

  return shaped;
}

// ---------------------------------------------------------------------------
// Tool: searchProducts
// ---------------------------------------------------------------------------

/**
 * Searches for products matching a query string, optionally filtered by
 * store or category.
 *
 * @param {object} params
 * @param {string} [params.query]      - Text to search in name/description/category
 * @param {string} [params.storeId]    - Filter to a specific store's products
 * @param {string} [params.category]   - Filter by product category
 * @param {number} [params.limit]      - Max results (capped at MAX_SEARCH_LIMIT)
 * @returns {Promise<{ products: object[], total: number }>}
 */
async function searchProducts({ query, storeId, category, limit } = {}) {
  const filter = {};

  // Only available products are surfaced to AI
  filter.available = true;
  filter.stock = { $gt: 0 };

  // Optional free-text search using case-insensitive regex across
  // name, description, and category fields.
  if (query && typeof query === "string" && query.trim().length > 0) {
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escapedQuery, $options: "i" } },
      { description: { $regex: escapedQuery, $options: "i" } },
      { category: { $regex: escapedQuery, $options: "i" } },
    ];
  }

  // Optional store filter
  if (storeId) {
    if (!isValidObjectId(storeId)) {
      throw new Error("Invalid storeId provided to searchProducts");
    }
    filter.store = new mongoose.Types.ObjectId(storeId);
  }

  // Optional category filter (exact, case-insensitive)
  if (category && typeof category === "string" && category.trim().length > 0) {
    filter.category = { $regex: `^${category.trim()}$`, $options: "i" };
  }

  // Clamp limit
  const resolvedLimit = Math.min(
    Math.max(1, parseInt(limit, 10) || DEFAULT_SEARCH_LIMIT),
    MAX_SEARCH_LIMIT,
  );

  const docs = await Product.find(filter)
    .select("name price description category stock available store")
    .limit(resolvedLimit)
    .lean();

  return {
    products: docs.map(shapeProduct),
    total: docs.length,
  };
}

// ---------------------------------------------------------------------------
// Tool: getNearbyStores
// ---------------------------------------------------------------------------

/**
 * Finds stores within a given radius of the provided coordinates.
 * Reuses the same $geoNear aggregation as the existing customer API route.
 *
 * @param {object} params
 * @param {number} params.latitude   - WGS-84 latitude  (-90 to 90)
 * @param {number} params.longitude  - WGS-84 longitude (-180 to 180)
 * @param {number} [params.radiusKm] - Search radius in km (default 8, max 50)
 * @returns {Promise<{ stores: object[], total: number }>}
 */
async function getNearbyStores({ latitude, longitude, radiusKm } = {}) {
  const coordCheck = validateCoordinates(Number(latitude), Number(longitude));
  if (!coordCheck.valid) {
    throw new Error(`getNearbyStores: ${coordCheck.reason}`);
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  const radius = Math.min(
    Math.max(0.1, Number(radiusKm) || DEFAULT_RADIUS_KM),
    MAX_RADIUS_KM,
  );

  const maxDistanceMeters = radius * 1000;

  const results = await Store.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distance",
        maxDistance: maxDistanceMeters,
        spherical: true,
      },
    },
    // Project: exclude owner, products array, __v
    {
      $project: {
        name: 1,
        description: 1,
        category: 1,
        distance: 1,
      },
    },
    { $limit: 20 },
  ]);

  return {
    stores: results.map((doc) => shapeStore(doc, doc.distance)),
    total: results.length,
  };
}

// ---------------------------------------------------------------------------
// Tool: getProductDetails
// ---------------------------------------------------------------------------

/**
 * Retrieves full details for a single product by ID.
 *
 * @param {object} params
 * @param {string} params.productId - MongoDB ObjectId string
 * @returns {Promise<{ product: object|null, found: boolean }>}
 */
async function getProductDetails({ productId } = {}) {
  if (!isValidObjectId(productId)) {
    throw new Error("getProductDetails: Invalid productId");
  }

  const doc = await Product.findById(productId)
    .select("name price description category stock available store")
    .lean();

  if (!doc) {
    return { product: null, found: false };
  }

  return { product: shapeProduct(doc), found: true };
}

// ---------------------------------------------------------------------------
// Tool: checkProductAvailability
// ---------------------------------------------------------------------------

/**
 * Checks whether a product is currently in stock and available.
 * Availability is always derived from the live database state —
 * the AI must never assume availability without calling this tool.
 *
 * @param {object} params
 * @param {string} params.productId - MongoDB ObjectId string
 * @returns {Promise<{ available: boolean, stock: number, found: boolean, productName: string|null }>}
 */
async function checkProductAvailability({ productId } = {}) {
  if (!isValidObjectId(productId)) {
    throw new Error("checkProductAvailability: Invalid productId");
  }

  const doc = await Product.findById(productId)
    .select("name stock available")
    .lean();

  if (!doc) {
    return { available: false, stock: 0, found: false, productName: null };
  }

  const available = doc.available !== false && doc.stock > 0;

  return {
    available,
    stock: doc.stock,
    found: true,
    productName: doc.name,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  searchProducts,
  getNearbyStores,
  getProductDetails,
  checkProductAvailability,
  // Export shapers for use in tests
  _shapeProduct: shapeProduct,
  _shapeStore: shapeStore,
};
