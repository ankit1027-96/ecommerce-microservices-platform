const axios = require("axios");
const logger = require("../config/logger");
const { services } = require("../config/services");

class ServiceRegistry {
  constructor() {
    this.serviceStatus = {};
    this.healthCheckInterval = 30000; // 30 seconds
    this.startHealthChecks();
  }

  async checkServiceHealth(serviceName, serviceConfig) {
    try {
      const response = await axios.get(
        `${serviceConfig.url}${serviceConfig.healthCheck}`,
        { timeout: 5000 }
      );

      const isHealthy = response.status === 200;

      if (this.serviceStatus[serviceName] !== isHealthy) {
        logger.info(
          `Service ${serviceName} status changed: ${isHealthy ? "UP" : "DOWN"}`
        );
      }

      this.serviceStatus[serviceName] = isHealthy;
      return isHealthy;
    } catch (error) {
      if (this.serviceStatus[serviceName] !== false) {
        logger.error(
          `Service ${serviceName} health check failed:`,
          error.message
        );
      }
      this.serviceStatus[serviceName] = false;
      return false;
    }
  }

  startHealthChecks() {
    // Initial health check
    this.performHealthChecks();

    // Periodic health checks
    setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  async performHealthChecks() {
    const healthPromises = Object.entries(services).map(([name, config]) =>
      this.checkServiceHealth(name, config)
    );

    await Promise.all(healthPromises);
  }

  isServiceHealthy(serviceName) {
    return this.serviceStatus[serviceName] === true;
  }

  getServiceStatus() {
    return { ...this.serviceStatus };
  }
}

module.exports = new ServiceRegistry();
