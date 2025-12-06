// app_api/routes/index.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const authController = require('../controllers/authentication');
const tripsController = require('../controllers/trips');

// --- Middleware ---
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = verified; // {_id,email,name,role,iat,exp}
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token validation error' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth) return res.status(401).json({ message: 'Unauthorized' });
  if (req.auth.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  next();
}

// --- Auth routes ---
router.post('/auth/forgot', authController.forgot);
router.post('/auth/reset', authController.reset);
router.post('/register', authController.register);
router.post('/login', authController.login);

// --- Trip routes ---
router
  .route('/trips')
  .get(tripsController.tripsList)
  .post(authenticateJWT, requireAdmin, tripsController.tripsAddTrip);

router
  .route('/trips/:tripCode')
  .get(tripsController.tripsFindByCode)
  .put(authenticateJWT, requireAdmin, tripsController.tripsUpdateTrip);

module.exports = router;
