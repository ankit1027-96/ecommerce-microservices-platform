const express = require('express')
const router = express.Router()
const cartController = require("../controllers/cartController")
const {extractUserOrSession, requireAuth} = require('../middleware/auth')
const {
    validateAddItem,
    validateUpdateItem,
    validateRemoveItem,
    validateCartQuery
} = require('../middleware/validation')

// Apply user/session extraction to all routes
router.use(extractUserOrSession)

// Cart routes (support both authenticated and guest user)
router.get('/', cartController.getCart)
router.get('/summary', cartController.getCartSummary)
router.post('/items', validateAddItem, cartController.addItem)
router.put('/items/:productId', validateUpdateItem, validateCartQuery, cartController.updateItem)
router.delete('/items/:productId', validateRemoveItem, validateCartQuery, cartController.removeItem)
router.delete('/', cartController.clearCart)

// Sync cart with product service
router.post('/sync-prices', cartController.syncPrices)

// Merge guest cart (Authention required)
router.post('/merge', requireAuth, cartController.mergeCart)

module.exports = router