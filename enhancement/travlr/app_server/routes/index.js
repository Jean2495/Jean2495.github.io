var express = require('express');
var router = express.Router();
const ctrlMain = require('../controllers/main');
const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', ctrlMain.index);
router.get('/health', (_req, res) => res.json({ ok: true }));

module.exports = router;
