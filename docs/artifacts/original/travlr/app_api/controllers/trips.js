const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Trip = require('../models/travlr'); 
const Model = mongoose.model('trips');    

// --- helpers ---
function getTokenFromHeader(req) {
  const h = req.headers.authorization || '';
  // expect "Bearer <token>"
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function getRoleFromReq(req) {
  const token = getTokenFromHeader(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload && payload.role ? payload.role : null;
  } catch {
    return null;
  }
}

function requireAdminOr403(req, res) {
  const role = getRoleFromReq(req);
  if (role !== 'admin') {
    res.status(403).json({ message: 'Admins only' });
    return false;
  }
  return true;
}

// GET: /trips - lists all the trips
const tripsList = async (req, res) => {
  try {
    const q = await Model.find({}).exec();
    if (!q || q.length === 0) {
      return res.status(404).json({ message: 'No trips found' });
    }
    return res.status(200).json(q);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

// GET: /trips/:tripCode - find by code
const tripsFindByCode = async (req, res) => {
  try {
    const q = await Model.find({ code: req.params.tripCode }).exec();
    if (!q || q.length === 0) {
      return res
        .status(404)
        .json({ message: `Trip with code ${req.params.tripCode} not found` });
    }
    return res.status(200).json(q);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

const tripsAddTrip = async (req, res) => {

  if (!requireAdminOr403(req, res)) return;

  try {
    const newTrip = new Trip({
      code: req.body.code,
      name: req.body.name,
      length: req.body.length,
      start: req.body.start, 
      resort: req.body.resort,
      perPerson: req.body.perPerson,
      image: req.body.image,
      description: req.body.description
    });

    const q = await newTrip.save();
    return res.status(201).json(q);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to create trip' });
  }
};


const tripsUpdateTrip = async (req, res) => {

  if (!requireAdminOr403(req, res)) return;

  try {
    // Uncomment for debugging
    // console.log(req.params);
    // console.log(req.body);

    const q = await Model.findOneAndUpdate(
      { code: req.params.tripCode },
      {
        code: req.body.code,
        name: req.body.name,
        length: req.body.length,
        start: req.body.start,
        resort: req.body.resort,
        perPerson: req.body.perPerson,
        image: req.body.image,
        description: req.body.description
      },
      { new: true } // return the updated document
    ).exec();

    if (!q) {
      return res
        .status(404)
        .json({ message: `Trip with code ${req.params.tripCode} not found` });
    }

    return res.status(200).json(q);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Failed to update trip' });
  }
};

module.exports = {
  tripsList,
  tripsFindByCode,
  tripsAddTrip,
  tripsUpdateTrip
};
