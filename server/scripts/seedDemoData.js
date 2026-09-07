const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const User = require("../models/user");
const Store = require("../models/store");
const Product = require("../models/product");

// Stable Unsplash CDN image URLs for grocery categories
const GROCERY_IMAGES = {
  milk: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80",
  oil: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80",
  atta: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80",
  rice: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80",
  salt: "https://images.unsplash.com/photo-1518110168401-f2877ee2c6ad?w=500&auto=format&fit=crop&q=80",
  tea: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80",
  sugar:
    "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=500&auto=format&fit=crop&q=80",
  spices:
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80",
  butter:
    "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500&auto=format&fit=crop&q=80",
  poha: "https://images.unsplash.com/photo-1613769049987-b31b641f25b1?w=500&auto=format&fit=crop&q=80",
  peanuts:
    "https://images.unsplash.com/photo-1567892568620-33230b00192d?w=500&auto=format&fit=crop&q=80",
  chillies:
    "https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=500&auto=format&fit=crop&q=80",
  tomatoes:
    "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80",
  onions:
    "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=80",
  noodles:
    "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=500&auto=format&fit=crop&q=80",
  detergent:
    "https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=500&auto=format&fit=crop&q=80",
  soap: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=500&auto=format&fit=crop&q=80",
  cookies:
    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80",
  dal: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80",
  paneer:
    "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80",
};

// Store master data (12 realistic Indian stores)
const STORES_DATA = [
  {
    ownerEmail: "owner_gupta_hsr@kiranawala.demo",
    ownerUsername: "gupta_hsr",
    ownerName: "Rajesh Gupta",
    storeName: "Gupta Kirana & General Store",
    category: "Kirana & General Store",
    description:
      "Your trusted neighborhood Kirana store in HSR Layout Sector 1. Fresh daily staples, dairy, and household goods.",
    location: { type: "Point", coordinates: [77.6389, 12.9121] }, // HSR Layout, Bengaluru
  },
  {
    ownerEmail: "owner_sharma_indiranagar@kiranawala.demo",
    ownerUsername: "sharma_indiranagar",
    ownerName: "Suresh Sharma",
    storeName: "Sharma Super Mart",
    category: "Supermarket",
    description:
      "Premium daily provisions, fresh dairy, packaged foods, and spices on 100 Feet Road, Indiranagar.",
    location: { type: "Point", coordinates: [77.6412, 12.9784] }, // Indiranagar, Bengaluru
  },
  {
    ownerEmail: "owner_lakshmi_koramangala@kiranawala.demo",
    ownerUsername: "lakshmi_koramangala",
    ownerName: "Venkat Lakshmi",
    storeName: "Lakshmi Provision Store",
    category: "Provisions",
    description:
      "Quality grains, pulses, oils, and organic spices. Serving Koramangala 4th Block since 1998.",
    location: { type: "Point", coordinates: [77.6245, 12.9352] }, // Koramangala, Bengaluru
  },
  {
    ownerEmail: "owner_patel_whitefield@kiranawala.demo",
    ownerUsername: "patel_whitefield",
    ownerName: "Mahesh Patel",
    storeName: "Patel Traders & Provisions",
    category: "Kirana & General Store",
    description:
      "Fast doorstep fulfillment for tech park residents in Whitefield. Wholesale prices on monthly grocery bundles.",
    location: { type: "Point", coordinates: [77.7499, 12.9698] }, // Whitefield, Bengaluru
  },
  {
    ownerEmail: "owner_ganesh_jayanagar@kiranawala.demo",
    ownerUsername: "ganesh_jayanagar",
    ownerName: "Ramesh Ganesh",
    storeName: "Sri Ganesh Kirana Store",
    category: "Daily Needs",
    description:
      "Authentic South Indian staples, fresh idli batter, ghee, and traditional spices in Jayanagar 3rd Block.",
    location: { type: "Point", coordinates: [77.5828, 12.925] }, // Jayanagar, Bengaluru
  },
  {
    ownerEmail: "owner_verma_cp@kiranawala.demo",
    ownerUsername: "verma_cp",
    ownerName: "Ajay Verma",
    storeName: "Verma Express Supermarket",
    category: "Supermarket",
    description:
      "Central Delhi premier express grocery supplier. Gourmet snacks, international teas, and essential staples.",
    location: { type: "Point", coordinates: [77.2167, 28.6304] }, // Connaught Place, New Delhi
  },
  {
    ownerEmail: "owner_sai_bandra@kiranawala.demo",
    ownerUsername: "sai_bandra",
    ownerName: "Nitin Sai",
    storeName: "Shree Sai Kirana & Daily Needs",
    category: "Daily Needs",
    description:
      "Hill Road Bandra local favorite. Fresh fruits, daily milk, imported cookies, and pantry supplies.",
    location: { type: "Point", coordinates: [72.8311, 19.0596] }, // Bandra West, Mumbai
  },
  {
    ownerEmail: "owner_reddy_jubilee@kiranawala.demo",
    ownerUsername: "reddy_jubilee",
    ownerName: "Vikram Reddy",
    storeName: "Reddy Retail & Essentials",
    category: "Provisions",
    description:
      "Premium rice varieties, Sona Masoori, cold-pressed oils, and farm fresh vegetables in Jubilee Hills.",
    location: { type: "Point", coordinates: [78.4071, 17.4319] }, // Jubilee Hills, Hyderabad
  },
  {
    ownerEmail: "owner_agarwal_mg@kiranawala.demo",
    ownerUsername: "agarwal_mg",
    ownerName: "Sunita Agarwal",
    storeName: "Agarwal Mini Mart",
    category: "Kirana & General Store",
    description:
      "Friendly neighborhood mini mart near MG Road, Pune. Clean packaged pulses, dry fruits, and household supplies.",
    location: { type: "Point", coordinates: [73.8742, 18.5167] }, // MG Road, Pune
  },
  {
    ownerEmail: "owner_balaji_malleswaram@kiranawala.demo",
    ownerUsername: "balaji_malleswaram",
    ownerName: "Balaji Rao",
    storeName: "Balaji Daily Provisions",
    category: "Daily Needs",
    description:
      "Heritage Malleshwaram store offering pure cow ghee, filter coffee powder, fresh milk, and whole grains.",
    location: { type: "Point", coordinates: [77.5702, 13.0031] }, // Malleshwaram, Bengaluru
  },
  {
    ownerEmail: "owner_khan_marathahalli@kiranawala.demo",
    ownerUsername: "khan_marathahalli",
    ownerName: "Imran Khan",
    storeName: "New City Grocery & General Store",
    category: "Supermarket",
    description:
      "24/7 active neighborhood general store catering to young professionals in Marathahalli.",
    location: { type: "Point", coordinates: [77.6974, 12.9591] }, // Marathahalli, Bengaluru
  },
  {
    ownerEmail: "owner_joshi_powai@kiranawala.demo",
    ownerUsername: "joshi_powai",
    ownerName: "Sangeeta Joshi",
    storeName: "Saraswati Kirana Bazaar",
    category: "Provisions",
    description:
      "Hiranandani Powai community grocery store. Eco-friendly packaging, fresh dairy, and organic flours.",
    location: { type: "Point", coordinates: [72.9051, 19.1176] }, // Powai, Mumbai
  },
];

// Product Template generator (returns 21 realistic Indian grocery items per store)
function generateProductsForStore() {
  return [
    {
      name: "Amul Taaza Toned Milk 500ml",
      price: 27,
      description:
        "Fresh pasteurized toned milk, rich in calcium and vitamins.",
      category: "Dairy & Eggs",
      stock: 25,
      available: true,
      image: GROCERY_IMAGES.milk,
    },
    {
      name: "Amul Butter Pasteurized 100g",
      price: 56,
      description:
        "Classic Indian salted butter, delicious for breakfast toast and cooking.",
      category: "Dairy & Eggs",
      stock: 2, // Low stock item
      available: true,
      image: GROCERY_IMAGES.butter,
    },
    {
      name: "Amul Fresh Paneer 200g",
      price: 95,
      description:
        "Soft and creamy fresh cottage cheese, perfect for paneer butter masala.",
      category: "Dairy & Eggs",
      stock: 12,
      available: true,
      image: GROCERY_IMAGES.paneer,
    },
    {
      name: "Aashirvaad Whole Wheat Atta 5kg",
      price: 245,
      description: "100% pure MP Sharbati whole wheat flour for soft rotis.",
      category: "Staples & Atta",
      stock: 18,
      available: true,
      image: GROCERY_IMAGES.atta,
    },
    {
      name: "India Gate Basmati Rice Feast Rozzana 1kg",
      price: 115,
      description:
        "Long grain aromatic basmati rice for daily meals and biryani.",
      category: "Staples & Atta",
      stock: 20,
      available: true,
      image: GROCERY_IMAGES.rice,
    },
    {
      name: "Tata Salt Vacuum Evaporated 1kg",
      price: 28,
      description:
        "Iodized salt enriched with essential nutrients for healthy meals.",
      category: "Staples & Atta",
      stock: 50,
      available: true,
      image: GROCERY_IMAGES.salt,
    },
    {
      name: "Sugar / Chini Superfine 1kg",
      price: 48,
      description:
        "Refined sparkling white sugar crystals for tea, coffee, and sweets.",
      category: "Staples & Atta",
      stock: 35,
      available: true,
      image: GROCERY_IMAGES.sugar,
    },
    {
      name: "Poha / Flattened Rice (Thick) 500g",
      price: 35,
      description: "Clean pressed rice flakes, ideal for quick breakfast poha.",
      category: "Staples & Atta",
      stock: 22,
      available: true,
      image: GROCERY_IMAGES.poha,
    },
    {
      name: "Toor Dal / Arhar Dal 1kg",
      price: 165,
      description:
        "Unpolished split pigeon peas, high protein for daily dal tadka.",
      category: "Staples & Atta",
      stock: 15,
      available: true,
      image: GROCERY_IMAGES.dal,
    },
    {
      name: "Fortune Sunlite Sunflower Oil 1L",
      price: 145,
      description: "Light and healthy refined sunflower oil rich in Vitamin E.",
      category: "Spices & Oils",
      stock: 16,
      available: true,
      image: GROCERY_IMAGES.oil,
    },
    {
      name: "MDH Turmeric Powder (Haldi) 100g",
      price: 38,
      description:
        "Pure ground turmeric root powder for natural golden color and aroma.",
      category: "Spices & Oils",
      stock: 30,
      available: true,
      image: GROCERY_IMAGES.spices,
    },
    {
      name: "Everest Garam Masala 100g",
      price: 72,
      description:
        "Aromatic blend of 13 spices for authentic Indian curry flavor.",
      category: "Spices & Oils",
      stock: 14,
      available: true,
      image: GROCERY_IMAGES.spices,
    },
    {
      name: "Tata Tea Gold Leaf Tea 500g",
      price: 310,
      description:
        "Rich blend of fine Assam tea leaves and long leaves for strong aroma.",
      category: "Snacks & Beverages",
      stock: 10,
      available: true,
      image: GROCERY_IMAGES.tea,
    },
    {
      name: "Maggi 2-Minute Noodles Masala 280g",
      price: 56,
      description: "Pack of 4 instant masala noodles with signature spice mix.",
      category: "Snacks & Beverages",
      stock: 24,
      available: true,
      image: GROCERY_IMAGES.noodles,
    },
    {
      name: "Britannia Good Day Cashew Cookies 200g",
      price: 40,
      description: "Crunchy butter cookies packed with rich cashew nuts.",
      category: "Snacks & Beverages",
      stock: 3, // Low stock item
      available: true,
      image: GROCERY_IMAGES.cookies,
    },
    {
      name: "Roasted Peanuts / Mungfali 200g",
      price: 45,
      description:
        "Salted roasted peanuts, great for evening snacks or poha topping.",
      category: "Snacks & Beverages",
      stock: 0, // Out of stock item
      available: false,
      image: GROCERY_IMAGES.peanuts,
    },
    {
      name: "Fresh Tomatoes / Tamatar 1kg",
      price: 35,
      description: "Farm fresh red ripe tomatoes for salads and curries.",
      category: "Fruits & Vegetables",
      stock: 12,
      available: true,
      image: GROCERY_IMAGES.tomatoes,
    },
    {
      name: "Onions / Pyaz 1kg",
      price: 30,
      description: "Fresh Nashik quality red onions, essential cooking staple.",
      category: "Fruits & Vegetables",
      stock: 40,
      available: true,
      image: GROCERY_IMAGES.onions,
    },
    {
      name: "Green Chillies / Hari Mirch 250g",
      price: 15,
      description: "Spicy fresh green chillies for cooking seasoning.",
      category: "Fruits & Vegetables",
      stock: 20,
      available: true,
      image: GROCERY_IMAGES.chillies,
    },
    {
      name: "Surf Excel Easy Wash Detergent Powder 1kg",
      price: 140,
      description:
        "Superior stain removal powder for washing machines and hand wash.",
      category: "Household",
      stock: 8,
      available: true,
      image: GROCERY_IMAGES.detergent,
    },
    {
      name: "Dettol Original Bathing Soap 125g (Pack of 3)",
      price: 135,
      description: "Germ protection bathing soap with pine fragrance.",
      category: "Personal Care",
      stock: 14,
      available: true,
      image: GROCERY_IMAGES.soap,
    },
  ];
}

async function connectMongo() {
  const primaryUri = process.env.MONGO_URI;
  const localUri = "mongodb://127.0.0.1:27017/kiranawala";

  if (primaryUri) {
    try {
      console.log("Attempting connection to MONGO_URI...");
      await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 3000 });
      console.log("Connected to primary MongoDB cluster successfully");
      return;
    } catch (err) {
      console.warn(
        `Primary MONGO_URI connection failed (${err.message}). Falling back to local MongoDB...`,
      );
    }
  }

  try {
    console.log(`Connecting to local MongoDB at: ${localUri}`);
    await mongoose.connect(localUri, { serverSelectionTimeoutMS: 3000 });
    console.log("Connected to local MongoDB successfully");
  } catch (err) {
    console.error("Local MongoDB connection failed:", err.message);
    throw err;
  }
}

async function seedData() {
  try {
    await connectMongo();

    console.log("\n==============================================");
    console.log("STARTING IDEMPOTENT DEMO DATA SEEDING (DAY 7)");
    console.log("==============================================\n");

    let storesCreated = 0;
    let storesUpdated = 0;
    let productsCreated = 0;
    let productsUpdated = 0;

    for (const storeData of STORES_DATA) {
      // 1. Ensure Store Owner user exists
      let owner = await User.findOne({ email: storeData.ownerEmail });

      if (!owner) {
        owner = new User({
          username: storeData.ownerUsername,
          email: storeData.ownerEmail,
          password: "Password123!", // Standard demo password
          role: "store-owner",
        });
        await owner.save();
        console.log(`[USER] Created store-owner: ${owner.email}`);
      } else {
        console.log(`[USER] Found existing store-owner: ${owner.email}`);
      }

      // 2. Ensure Store exists
      let store = await Store.findOne({ owner: owner._id });

      if (!store) {
        store = new Store({
          name: storeData.storeName,
          category: storeData.category,
          description: storeData.description,
          owner: owner._id,
          location: storeData.location,
          products: [],
        });
        await store.save();
        storesCreated++;
        console.log(`[STORE] Created store: "${store.name}" (${store._id})`);
      } else {
        store.name = storeData.storeName;
        store.category = storeData.category;
        store.description = storeData.description;
        store.location = storeData.location;
        await store.save();
        storesUpdated++;
        console.log(`[STORE] Updated store: "${store.name}" (${store._id})`);
      }

      // 3. Seed Products for Store
      const storeProductsList = generateProductsForStore();
      const productIds = [];

      for (const prodData of storeProductsList) {
        let product = await Product.findOne({
          store: store._id,
          name: prodData.name,
        });

        if (!product) {
          product = new Product({
            ...prodData,
            store: store._id,
          });
          await product.save();
          productsCreated++;
        } else {
          product.price = prodData.price;
          product.description = prodData.description;
          product.category = prodData.category;
          product.stock = prodData.stock;
          product.available = prodData.available;
          product.image = prodData.image;
          await product.save();
          productsUpdated++;
        }
        productIds.push(product._id);
      }

      // Sync store products array
      store.products = productIds;
      await store.save();
    }

    // Verification queries
    const totalStores = await Store.countDocuments();
    const totalProducts = await Product.countDocuments();
    const storesWithLowStock = await Product.distinct("store", {
      stock: { $lte: 3 },
    });
    const storesWithOutOfStock = await Product.distinct("store", { stock: 0 });

    console.log("\n==============================================");
    console.log("SEEDING COMPLETE — SUMMARY REPORT");
    console.log("==============================================");
    console.log(
      `Stores Created / Updated: ${storesCreated} new, ${storesUpdated} updated`,
    );
    console.log(
      `Products Created / Updated: ${productsCreated} new, ${productsUpdated} updated`,
    );
    console.log(`Total Stores in DB: ${totalStores}`);
    console.log(`Total Products in DB: ${totalProducts}`);
    console.log(
      `Stores with low stock items (stock <= 3): ${storesWithLowStock.length}`,
    );
    console.log(
      `Stores with out-of-stock items (stock == 0): ${storesWithOutOfStock.length}`,
    );
    console.log("==============================================\n");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Mongoose connection closed.");
  }
}

seedData();
