class CalculationService {
  constructor() {
    this.taxRate = parseFloat(process.env.DEFAULT_TAX_RATE) || 0.18;
    this.freeShippingThreshold =
      parseFloat(process.env.FREE_SHIPPING_THRESHOLD) || 500;
    this.standardShippingCost = parseFloat(process.env.STANDARD_SHIPPING_COST);
  }

  calculateSubtotal(items) {
    return items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
  }

  calculateTax(subtotal) {
    return Math.round(subtotal * this.taxRate * 100) / 100;
  }

  calculateShipping(subtotal) {
    if (subtotal >= this.freeShippingThreshold) {
      return 0;
    }
    return this.standardShippingCost;
  }

  calculateTotal(subtotal, tax, shipping, discount = 0) {
    return Math.max(0, subtotal + tax + shipping - discount);
  }

  calculateCartTotals(items, discount = 0) {
    const subtotal = this.calculateSubtotal(items);
    const tax = this.calculateTax(subtotal);
    const shipping = this.calculateShipping(subtotal);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      shipping: Math.round(shipping * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  formatCurrency(amount, currency = "INR") {
    return {
      amount: Math.round(amount * 100) / 100,
      currency,
      formatted: `₹${amount.toFixed(2)}`,
    };
  }
}

module.exports = new CalculationService();
