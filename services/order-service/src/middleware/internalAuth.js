const requireInternalService = (req, res, next) => {
  const service = req.headers["x-internal-service"];
  const allowedServices = ["payment-service", "payment_service"]; // accept either casing/style you use elsewhere
  if (!service || !allowedServices.includes(service)) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: internal service access only",
    });
  }
  next();
};

module.exports = { requireInternalService };
