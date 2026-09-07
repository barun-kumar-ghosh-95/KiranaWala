/**
 * KiranaWala AI — Shopping Intent & Basket Service
 *
 * Responsibilities:
 *  1. Parse natural language shopping intents ("Tea for 5 people", "Breakfast for 4", "Chai under ₹200")
 *  2. Handle ambiguous prompts with concise clarifying prompts
 *  3. Search real MongoDB products from nearby stores for required items
 *  4. Enforce strict single-store cart consistency
 *  5. Calculate exact verified line subtotals and basket totals strictly from DB prices
 *  6. Handle budget constraints, out-of-stock items, and missing ingredients
 */

"use strict";

const Store = require("../../models/store");
const Product = require("../../models/product");

// ---------------------------------------------------------------------------
// Intent Keywords & Preset Ingredient Maps
// ---------------------------------------------------------------------------

const INTENT_RECIPES = {
  chai: {
    purpose: "make tea",
    keywords: ["tea", "chai", "tea for", "chai for", "make tea", "make chai"],
    items: [
      {
        name: "tea",
        category: "Snacks & Beverages",
        keywords: ["tea", "chai"],
      },
      { name: "milk", category: "Dairy & Eggs", keywords: ["milk", "doodh"] },
      {
        name: "sugar",
        category: "Staples & Atta",
        keywords: ["sugar", "chini"],
      },
    ],
  },
  breakfast: {
    purpose: "breakfast",
    keywords: ["breakfast", "nashta", "morning breakfast"],
    items: [
      {
        name: "atta",
        category: "Staples & Atta",
        keywords: ["atta", "flour", "wheat"],
      },
      { name: "milk", category: "Dairy & Eggs", keywords: ["milk", "doodh"] },
      {
        name: "butter",
        category: "Dairy & Eggs",
        keywords: ["butter", "makhan"],
      },
      {
        name: "tea",
        category: "Snacks & Beverages",
        keywords: ["tea", "chai"],
      },
    ],
  },
  movie_night: {
    purpose: "movie night snacks",
    keywords: [
      "movie night",
      "snacks for movie",
      "snack night",
      "evening snacks",
    ],
    items: [
      {
        name: "cookies",
        category: "Snacks & Beverages",
        keywords: ["cookies", "biscuits"],
      },
      {
        name: "noodles",
        category: "Snacks & Beverages",
        keywords: ["noodles", "maggi"],
      },
      {
        name: "peanuts",
        category: "Snacks & Beverages",
        keywords: ["peanuts", "mungfali"],
      },
    ],
  },
  basic_groceries: {
    purpose: "basic groceries",
    keywords: [
      "basic groceries",
      "daily essentials",
      "pantry staples",
      "groceries for today",
    ],
    items: [
      { name: "atta", category: "Staples & Atta", keywords: ["atta", "flour"] },
      {
        name: "rice",
        category: "Staples & Atta",
        keywords: ["rice", "chawal"],
      },
      { name: "salt", category: "Staples & Atta", keywords: ["salt", "namak"] },
      { name: "oil", category: "Spices & Oils", keywords: ["oil", "tel"] },
    ],
  },
};

// ---------------------------------------------------------------------------
// Intent Parser
// ---------------------------------------------------------------------------

/**
 * Analyzes natural language message for shopping intent, servings, budget, and ambiguity.
 *
 * @param {string} message
 * @returns {object} Parsed intent metadata
 */
function parseShoppingIntent(message) {
  if (typeof message !== "string") {
    return { isIntent: false };
  }

  const lower = message.toLowerCase().trim();

  // Ambiguity Check: Vague prompts with no clear meal, item list, or quantity
  if (
    lower === "i want tea" ||
    lower === "give me groceries" ||
    lower === "i need food" ||
    lower === "find stuff"
  ) {
    return {
      isIntent: true,
      isAmbiguous: true,
      clarificationPrompt: lower.includes("tea")
        ? "What kind of tea plan do you have? For example: 'Tea for 5 people' or 'Chai ingredients under ₹200'."
        : "What are you planning to shop for? For example: 'Breakfast for 4 people', 'Tea for 5', or 'Movie night snacks'.",
    };
  }

  // Extract servings (e.g. "for 5 people", "for 4", "servings: 5")
  let servings = 1;
  const servingsMatch = lower.match(/(?:for|servings?:?)\s*(\d+)/i);
  if (servingsMatch) {
    servings = parseInt(servingsMatch[1], 10) || 1;
  }

  // Extract budget (e.g. "under ₹200", "under 200", "budget 300", "below 250")
  let budget = null;
  const budgetMatch = lower.match(
    /(?:under|below|budget|within|max)\s*₹?\s*(\d+)/i,
  );
  if (budgetMatch) {
    budget = parseInt(budgetMatch[1], 10);
  }

  // Explicit Intent Patterns
  const isChaiIntent =
    /\b(tea|chai)\s*(for|ingredients|under|below|make|\d+)/i.test(lower) ||
    /\b(make|ingredients|recipe)\s*(tea|chai)\b/i.test(lower);
  const isBreakfastIntent =
    /\bbreakfast\s*(for|essentials|\d+)?\b/i.test(lower) ||
    /\bnashta\b/i.test(lower);
  const isMovieIntent = /\bmovie\s*(night|snacks?)\b/i.test(lower);
  const isBasicGroceriesIntent =
    /\b(basic groceries|groceries for|daily essentials|pantry staples)\b/i.test(
      lower,
    );

  let matchedRecipe = null;
  if (isChaiIntent) {
    matchedRecipe = INTENT_RECIPES.chai;
  } else if (isBreakfastIntent) {
    matchedRecipe = INTENT_RECIPES.breakfast;
  } else if (isMovieIntent) {
    matchedRecipe = INTENT_RECIPES.movie_night;
  } else if (isBasicGroceriesIntent) {
    matchedRecipe = INTENT_RECIPES.basic_groceries;
  }

  if (!matchedRecipe) {
    return { isIntent: false };
  }

  return {
    isIntent: true,
    isAmbiguous: false,
    purpose: matchedRecipe.purpose,
    servings,
    budget,
    requiredItems: matchedRecipe.items,
  };
}

// ---------------------------------------------------------------------------
// Backend Product Matching & Single-Store Basket Construction
// ---------------------------------------------------------------------------

/**
 * Builds a verified single-store basket from MongoDB products for a given intent.
 *
 * @param {object} params
 * @param {string} params.purpose
 * @param {number} [params.servings=1]
 * @param {number|null} [params.budget=null]
 * @param {Array<object>} params.requiredItems
 * @param {object} [params.userContext] - { latitude, longitude }
 * @returns {Promise<object>} Verified intent result with DB basket
 */
async function buildIntentBasket({
  purpose,
  servings = 1,
  budget = null,
  requiredItems = [],
  userContext = {},
}) {
  // 1. Determine nearby stores or all active stores
  let storeCandidates = [];
  const lat = Number(userContext.latitude);
  const lng = Number(userContext.longitude);

  if (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    const nearby = await Store.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distance",
          maxDistance: 50000, // 50km max
          spherical: true,
        },
      },
      { $limit: 15 },
    ]);
    storeCandidates = nearby;
  }

  if (storeCandidates.length === 0) {
    storeCandidates = await Store.find({}).limit(15).lean();
  }

  if (storeCandidates.length === 0) {
    return {
      message: "No stores are currently available in your area.",
      intent: { type: "shopping_intent", purpose, servings, budget },
      products: [],
      basket: null,
    };
  }

  // 2. Evaluate candidate stores for fulfillment of required items
  let bestStoreMatch = null;

  for (const storeDoc of storeCandidates) {
    const storeId = storeDoc._id.toString();
    const matchedLineItems = [];
    const missingItems = [];

    for (const reqItem of requiredItems) {
      // Find available product matching keywords in this store
      const regexQueries = reqItem.keywords.map((kw) => ({
        name: { $regex: kw, $options: "i" },
      }));

      const candidateProduct = await Product.findOne({
        store: storeDoc._id,
        available: { $ne: false },
        stock: { $gt: 0 },
        $or: regexQueries,
      }).lean();

      if (candidateProduct) {
        // Calculate pack quantity needed (default 1 pack per item)
        const packQuantity = 1;
        const subtotal = candidateProduct.price * packQuantity;

        matchedLineItems.push({
          product: {
            _id: candidateProduct._id.toString(),
            name: candidateProduct.name,
            price: candidateProduct.price,
            description: candidateProduct.description || "",
            category: candidateProduct.category || "General",
            stock: candidateProduct.stock,
            available: true,
            image: candidateProduct.image || null,
            store: {
              _id: storeId,
              name: storeDoc.name,
              category: storeDoc.category || "General",
            },
          },
          requestedItem: reqItem.name,
          quantity: packQuantity,
          subtotal,
        });
      } else {
        missingItems.push(reqItem.name);
      }
    }

    const totalSubtotal = matchedLineItems.reduce(
      (acc, item) => acc + item.subtotal,
      0,
    );

    const storeMatchObj = {
      store: {
        _id: storeId,
        name: storeDoc.name,
        description: storeDoc.description || "",
        category: storeDoc.category || "General",
        distanceKm:
          typeof storeDoc.distance === "number"
            ? parseFloat((storeDoc.distance / 1000).toFixed(2))
            : null,
      },
      items: matchedLineItems,
      total: totalSubtotal,
      missingItems,
      isCompleteBasket: missingItems.length === 0,
      matchCount: matchedLineItems.length,
    };

    // Rank store: prioritize 100% complete baskets, higher match counts, then lower distance
    if (!bestStoreMatch) {
      bestStoreMatch = storeMatchObj;
    } else {
      if (storeMatchObj.isCompleteBasket && !bestStoreMatch.isCompleteBasket) {
        bestStoreMatch = storeMatchObj;
      } else if (storeMatchObj.matchCount > bestStoreMatch.matchCount) {
        bestStoreMatch = storeMatchObj;
      } else if (
        storeMatchObj.matchCount === bestStoreMatch.matchCount &&
        storeMatchObj.total < bestStoreMatch.total
      ) {
        bestStoreMatch = storeMatchObj;
      }
    }
  }

  if (!bestStoreMatch || bestStoreMatch.items.length === 0) {
    return {
      message: `I couldn't find matching products in nearby stores for ${purpose}.`,
      intent: { type: "shopping_intent", purpose, servings, budget },
      products: [],
      basket: null,
    };
  }

  // 3. Handle budget constraint strictly with DB prices
  const isWithinBudget = budget ? bestStoreMatch.total <= budget : true;
  let budgetMessage = "";

  if (budget && !isWithinBudget) {
    budgetMessage = `I couldn't find a complete basket under ₹${budget}. The closest complete option is ₹${bestStoreMatch.total}.`;
  }

  // 4. Construct human response text
  let responseText = "";
  if (bestStoreMatch.isCompleteBasket) {
    if (budget && !isWithinBudget) {
      responseText = `${budgetMessage} Found all items at ${bestStoreMatch.store.name}.`;
    } else {
      responseText = `I found everything you need for ${purpose} (${servings} ${servings === 1 ? "person" : "people"}) from ${bestStoreMatch.store.name} for ₹${bestStoreMatch.total}.`;
    }
  } else {
    const missingStr = bestStoreMatch.missingItems.join(", ");
    responseText = `Found ${bestStoreMatch.items.length} of ${requiredItems.length} items at ${bestStoreMatch.store.name} for ₹${bestStoreMatch.total}. Missing in stock: ${missingStr}.`;
  }

  // 5. Build products array for frontend rendering
  const productsArray = bestStoreMatch.items.map((item) => item.product);

  const resultBasket = {
    storeId: bestStoreMatch.store._id,
    storeName: bestStoreMatch.store.name,
    distanceKm: bestStoreMatch.store.distanceKm,
    items: bestStoreMatch.items,
    total: bestStoreMatch.total,
    missingItems: bestStoreMatch.missingItems,
    isWithinBudget,
    budget,
    isCompleteBasket: bestStoreMatch.isCompleteBasket,
  };

  return {
    message: responseText,
    intent: {
      type: "shopping_intent",
      purpose,
      servings,
      budget,
    },
    products: productsArray,
    basket: resultBasket,
  };
}

module.exports = {
  parseShoppingIntent,
  buildIntentBasket,
  INTENT_RECIPES,
};
