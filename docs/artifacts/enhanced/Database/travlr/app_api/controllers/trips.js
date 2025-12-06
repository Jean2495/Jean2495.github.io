/* Controller layer for Trip resources.
 * Responsibilities:
 *   - Input shaping and minimal validation
 *   - Orchestrating calls to the data layer (Mongoose model)
 *   - Returning consistent HTTP status codes and JSON payloads
 */

const {
    Types: { ObjectId },
} = require('mongoose');
const Trip = require('../models/travlr'); // Mongoose model bound to the 'trips' collection

// -----------------------------------------------------------------------------
// Small response helpers to keep status-code usage consistent across actions.
// -----------------------------------------------------------------------------
const ok = (res, data) => res.status(200).json(data); // 200 OK with payload
const created = (res, data) => res.status(201).json(data); // 201 Created with resource
const badReq = (res, msg, extra = {}) => res.status(400).json({ message: msg, ...extra }); // 400 with reason
const notFound = (res, msg) => res.status(404).json({ message: msg }); // 404 with reason
const fail = (res, err) => res.status(500).json({ message: err?.message || 'Server error' }); // 500 fallback

// -----------------------------------------------------------------------------
// Field whitelist to prevent mass-assignment
// -----------------------------------------------------------------------------
const pickTripFields = (b = {}) => ({
    code: b.code,
    name: b.name,
    length: b.length,
    start: b.start, // Date-compatible value; parsed in validation
    resort: b.resort,
    perPerson: b.perPerson,
    image: b.image,
    description: b.description,
});

// -----------------------------------------------------------------------------
// Minimal synchronous validation for required fields and date coercion.
// Ensures required keys are present and that `start` is a valid date.
// -----------------------------------------------------------------------------
const validateTripBody = (b = {}) => {
    const required = [
        'code',
        'name',
        'length',
        'start',
        'resort',
        'perPerson',
        'image',
        'description',
    ];
    const missing = required.filter((k) => !b[k] || String(b[k]).trim() === '');
    if (missing.length) {
        return { ok: false, reason: 'Missing required fields', missing };
    }
    const d = new Date(b.start);
    if (Number.isNaN(d.getTime())) {
        return { ok: false, reason: 'Invalid start date' };
    }
    return { ok: true };
};

// -----------------------------------------------------------------------------
// Filter + cursor helpers used by the paginated search endpoint.
// -----------------------------------------------------------------------------

/* Builds a MongoDB query object from high-level filter parameters.
 * Supported filters:
 *   - resort: case-insensitive partial match
 *   - startFrom / startTo: inclusive date range on `start`
 */
const buildTripQuery = (filters = {}) => {
    const query = {};

    if (filters.resort) {
        query.resort = { $regex: new RegExp(String(filters.resort).trim(), 'i') };
    }

    const range = {};
    if (filters.startFrom) {
        const from = new Date(filters.startFrom);
        if (!Number.isNaN(from.getTime())) range.$gte = from;
    }
    if (filters.startTo) {
        const to = new Date(filters.startTo);
        if (!Number.isNaN(to.getTime())) range.$lte = to;
    }
    if (Object.keys(range).length) {
        query.start = range;
    }

    return query;
};

/* Encodes and decodes cursor tokens based on the MongoDB ObjectId.
 * The cursor is a base64url representation of the last document's _id.
 */
const encodeCursor = (id) => Buffer.from(String(id), 'utf8').toString('base64url');

const decodeCursor = (cursor) => {
    try {
        const raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
        if (!ObjectId.isValid(raw)) return null;
        return new ObjectId(raw);
    } catch {
        return null;
    }
};

// -----------------------------------------------------------------------------
// GET /trips
// Returns all trips as plain JavaScript objects. An empty array is returned
// when no documents exist. Uses lean() for reduced overhead and faster reads.
// -----------------------------------------------------------------------------
const tripsList = async (_req, res) => {
    try {
        const docs = await Trip.find({}).lean().exec();
        return ok(res, docs || []);
    } catch (err) {
        return fail(res, err);
    }
};

// -----------------------------------------------------------------------------
// GET /trips/search
// Cursor-based, filterable listing of trips.
// Query parameters:
//   - resort: optional substring match on resort name
//   - startFrom / startTo: optional ISO date range on `start`
//   - limit: maximum number of records per page (1..50, default 5)
//   - cursor: opaque pagination token from previous response
// -----------------------------------------------------------------------------
const tripsSearchPaginated = async (req, res) => {
    try {
        const { resort, startFrom, startTo, cursor } = req.query;

        const limitRaw = parseInt(req.query.limit, 10);
        const limit = Number.isNaN(limitRaw) ? 5 : Math.min(Math.max(limitRaw, 1), 50);

        const query = buildTripQuery({ resort, startFrom, startTo });

        let cursorId = null;
        if (cursor) {
            cursorId = decodeCursor(cursor);
            if (!cursorId) {
                return badReq(res, 'Invalid cursor token');
            }
            query._id = { $gt: cursorId };
        }

        const docs = await Trip.find(query)
            .sort({ _id: 1 })
            .limit(limit + 1)
            .lean()
            .exec();

        let nextCursor = null;
        if (docs.length > limit) {
            const lastVisible = docs[limit - 1];
            nextCursor = encodeCursor(lastVisible._id);
            docs.length = limit;
        }

        return ok(res, { trips: docs, nextCursor });
    } catch (err) {
        return fail(res, err);
    }
};

// -----------------------------------------------------------------------------
// GET /trips/:tripCode
// Fetches a single trip by its business key `code`. The payload is returned
// as a single-element array to preserve the existing client response shape.
// -----------------------------------------------------------------------------
const tripsFindByCode = async (req, res) => {
    try {
        const code = String(req.params.tripCode || '').trim();
        if (!code) return badReq(res, 'Trip code required');

        const doc = await Trip.findOne({ code }).lean().exec();
        if (!doc) return notFound(res, `Trip with code ${code} not found`);

        return ok(res, [doc]);
    } catch (err) {
        return fail(res, err);
    }
};

// -----------------------------------------------------------------------------
// POST /trips
// Creates a new trip document. Authorization is enforced at the route level.
// Performs minimal validation and guards against duplicate `code` values.
// Duplicate-key errors return HTTP 409.
// -----------------------------------------------------------------------------
const tripsAddTrip = async (req, res) => {
    try {
        const body = pickTripFields(req.body);
        const v = validateTripBody(body);
        if (!v.ok) return badReq(res, v.reason, v.missing ? { missing: v.missing } : undefined);

        const existing = await Trip.findOne({ code: body.code }).lean().exec();
        if (existing) {
            return res.status(409).json({ message: `Trip code '${body.code}' already exists` });
        }

        const createdDoc = await new Trip(body).save();
        return created(res, createdDoc);
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ message: 'Duplicate key', keyValue: err.keyValue });
        }
        return badReq(res, err.message || 'Failed to create trip');
    }
};

// -----------------------------------------------------------------------------
// PUT /trips/:tripCode
// Updates a trip identified by `:tripCode`. The request body is validated and
// restricted to whitelisted fields. The `code` field is not mutated to keep
// the path parameter authoritative for the targeted resource.
// -----------------------------------------------------------------------------
const tripsUpdateTrip = async (req, res) => {
    try {
        const code = String(req.params.tripCode || '').trim();
        if (!code) return badReq(res, 'Trip code required');

        const body = pickTripFields(req.body);
        const v = validateTripBody({ ...body, code: body.code || code });
        if (!v.ok) return badReq(res, v.reason, v.missing ? { missing: v.missing } : undefined);

        delete body.code;

        const updated = await Trip.findOneAndUpdate({ code }, body, { new: true }).exec();
        if (!updated) return notFound(res, `Trip with code ${code} not found`);

        return ok(res, updated);
    } catch (err) {
        if (err?.code === 11000) {
            return res.status(409).json({ message: 'Duplicate key', keyValue: err.keyValue });
        }
        return badReq(res, err.message || 'Failed to update trip');
    }
};

// -----------------------------------------------------------------------------
// GET /trips/analytics
// Returns aggregated analytics over the trips collection.
// Used for the Category Three: Databases enhancement.
// -----------------------------------------------------------------------------
const tripsAnalytics = async (_req, res) => {
    try {
        const results = await Trip.getAnalytics();
        return ok(res, results);
    } catch (err) {
        return fail(res, err);
    }
};

module.exports = {
    tripsList,
    tripsSearchPaginated,
    tripsFindByCode,
    tripsAddTrip,
    tripsUpdateTrip,
    tripsAnalytics,
};
