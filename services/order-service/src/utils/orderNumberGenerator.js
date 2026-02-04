const crypto = require("crypto");

class OrderNumberGenerator {
  constructor() {
    this.prefix = process.env.ORDER_PREFIX || "ORD";
    this.length = parseInt(process.env.ORDER_NUMBER_LENGTH) || 10;
  }

  generate() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();
    const orderNumber = `${this.prefix}${timestamp}${random}`;
    return orderNumber;
  }

  validate(orderNumber) {
    const pattern = new RegExp(`^${this.prefix}[A-Z0-9]{${this.length}}$`);
    return pattern.test(orderNumber);
  }
}

module.exports = new OrderNumberGenerator();
