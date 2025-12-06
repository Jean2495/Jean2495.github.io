/* Trip repository layer.
 * ----------------------
 * Encapsulates direct Mongoose access for the `Trip` model.
 * Controllers and services depend on this module instead of using
 * the Mongoose model directly, which keeps persistence concerns isolated.
 */

const Trip = require('../models/travlr');

/**
 * Returns all trips as plain JavaScript objects.
 */
exports.findAll = () => {
    return Trip.find({}).lean().exec();
};

/**
 * Looks up a single trip by its business key `code`.
 * Returns the matching document or null when none exists.
 */
exports.findByCode = (code) => {
    return Trip.findOne({ code }).lean().exec();
};

/**
 * Creates a new trip record based on the supplied payload.
 */
exports.create = (payload) => {
    const doc = new Trip(payload);
    return doc.save();
};

/**
 * Updates an existing trip identified by `code` with the given payload.
 * Returns the updated document or null when no document matches.
 */
exports.updateByCode = (code, payload) => {
    return Trip.findOneAndUpdate({ code }, payload, { new: true }).exec();
};

/**
 * Returns aggregated analytics over the trips collection.
 * Delegates to the static `getAnalytics` helper on the Trip model.
 */
exports.getAnalytics = () => {
    return Trip.getAnalytics();
};
