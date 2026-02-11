const redis = require("../config/redis");
const productClient = require("./productClient");
const logger = require("../config/logger");

class InventoryService {
  constructor() {
    this.reservationTTL =
      parseInt(process.env.INVENTORY_RESERVATION_TIMEOUT_MINUTES) * 60 || 1800; // 30 mins
  }

  generateReservationKey(orderId) {
    return `inventory:reservation:${orderId}`;
  }

  async reserveInventory(orderId, items) {
    try {
      const reservations = [];

      for (const item of items) {
        const reserved = await productClient.reserveStock(
          item.productId,
          item.quantity,
        );

        if (reserved) {
          reservations.push({
            productId: item.productId,
            quantity: item.quantity,
          });
        } else {
          // Rollback previous reservations
          await this.releaseReservations(reservations);
          throw new Error(
            `Failed to reserve stock for product: ${item.productId}`,
          );
        }
      }

      // Store reservation in Redis with TTL
      const reservationKey = this.generateReservationKey(orderId);
      await redis.set(reservationKey, reservations, this.reservationTTL);

      logger.info("Inventory reserved:", { orderId, items: reservations });
      return true;
    } catch (error) {
      logger.error("Reserve inventory error:", error);
      throw error;
    }
  }

  async confirmInventory(orderId) {
    try {
      const reservationKey = this.generateReservationKey(orderId);
      const reservations = await redis.get(reservationKey);

      if (!reservations) {
        logger.warn("No inventory reservation found:", { orderId });
        return false;
      }

      // Decrement actual stock
      for (const reservation of reservations) {
        await productClient.decrementStock(
          reservation.productId,
          reservation.quantity,
        );
      }

      // Remove reservation
      await redis.del(reservationKey);

      logger.info("Inventory confirmed:", { orderId });
      return true;
    } catch (error) {
      logger.error("Confirm inventory error:", error);
      throw error;
    }
  }

  async releaseReservations(orderId) {
    try {
      const reservationKey = this.generateReservationKey(orderId);
      const reservations = redis.get(reservationKey);

      if (!reservations) {
        logger.warn("No inventory reservation to release:", { orderId });
        return false;
      }

      await this.releaseReservations(reservations);
      await redis.del(reservationKey);

      logger.info("Inventory reservation released:", error);
      return false;
    } catch (error) {
      logger.error("Release inventory error:", error);
      return false;
    }
  }

  async releaseReservations(reservations) {
    for (const reservation of reservations) {
      await productClient.releaseStock(
        reservation.productId,
        reservation.quantity,
      );
    }
  }
}

module.exports = new InventoryService();
