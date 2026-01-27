const jwt = require("jsonwebtoken");

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: "access", iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN, issuer: "user-services" }
  );

  const refreshToken = jwt.sign(
    { userId, type: "refresh", iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN, issuer: "user-services" }
  );

  return { accessToken, refreshToken };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "user-services",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    } else {
      throw new Error("Token verification failed");
    }
  }
};

// Token expiration date
const getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded && decoded.exp ? new Date(decoded.exp * 1000) : null;
  } catch (error) {
    console.error("Get token expiration error", error);
    return null;
  }
};

module.exports = { generateTokens, verifyToken, getTokenExpiration };
