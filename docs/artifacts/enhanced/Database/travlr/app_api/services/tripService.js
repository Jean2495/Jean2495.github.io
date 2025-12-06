/* Trip service layer.
 * Provides an abstraction over the trip repository so that controllers
 * depend on a narrow, testable API instead of Mongoose directly.
 */

const repo = require('../repositories/tripRepo');

/**
 * Returns all trips from the repository.
 */
exports.list = () => {
    return repo.findAll();
};

/**
 * Looks up a single trip by its business key `code`.
 * Returns the matching document or null when none exists.
 */
exports.getByCode = async (code) => {
    const doc = await repo.findByCode(code);
    return doc;
};

/**
 * Creates a new trip record based on the supplied payload.
 */
exports.add = (payload) => {
    return repo.create(payload);
};

/**
 * Updates an existing trip identified by `code` with the given payload.
 */
exports.update = (code, payload) => {
    return repo.updateByCode(code, payload);
};

/**
 * Returns aggregated analytics for trips, grouped by resort.
 * Used by the databases enhancement to support admin dashboards.
 */
exports.analytics = () => {
    return repo.getAnalytics();
};
