const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    category: {
      type: String,
      default: "General",
    },
    stock: {
      type: Number,
      default: 10,
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

productSchema.index({ store: 1 });

module.exports = mongoose.model("Product", productSchema);
