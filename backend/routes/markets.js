const express = require('express');
const router = express.Router();

function mockRouteUnavailable(res, route) {
  return res.status(503).json({
    error: 'Legacy market route unavailable in production',
    message: `${route} still uses mock data and has been disabled. Use /api/market-data instead.`,
  });
}

router.get('/instruments', (req, res) => {
  return mockRouteUnavailable(res, '/api/markets/instruments');
});

router.get('/price/:symbol', (req, res) => {
  return mockRouteUnavailable(res, '/api/markets/price/:symbol');
});

router.get('/history/:symbol', (req, res) => {
  return mockRouteUnavailable(res, '/api/markets/history/:symbol');
});

router.get('/movers', (req, res) => {
  return mockRouteUnavailable(res, '/api/markets/movers');
});

module.exports = router;
