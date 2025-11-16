// Simple schema-based validator (no external deps)
exports.requireTripBody = (req, res, next) => {
    const b = req.body || {};
    const missing = [
        'code',
        'name',
        'length',
        'start',
        'resort',
        'perPerson',
        'image',
        'description',
    ].filter((k) => !b[k] || String(b[k]).trim() === '');
    if (missing.length) {
        return res.status(400).json({ message: 'Missing required fields', missing });
    }
    // basic date check
    if (isNaN(new Date(b.start).getTime())) {
        return res.status(400).json({ message: 'Invalid start date' });
    }
    next();
};
