const jwt = require("jsonwebtoken");
const User = require("../models/user");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "your_jwt_secret";

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = decoded; // Contains { id: user._id }
    next();
  });
};

const requireStoreOwner = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }

    if (user.role !== "store-owner") {
      return res
        .status(403)
        .json({ message: "Access denied: Store owner role required" });
    }

    next();
  } catch (error) {
    console.error("Error in requireStoreOwner middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  authenticateToken,
  requireStoreOwner,
};
