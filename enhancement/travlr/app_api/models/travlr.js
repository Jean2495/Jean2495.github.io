/**
 * app_api/models/travlr.js
 *
 * Travlr Trip Schema
 * ------------------
 * Defines and exports the Mongoose schema for the `trips` collection.
 * This model enforces structure, validation rules, and indexes to ensure
 * consistent, performant access to trip data.
 */

const mongoose = require('mongoose');

// -----------------------------------------------------------------------------
// Trip Schema Definition
// -----------------------------------------------------------------------------
const tripSchema = new mongoose.Schema(
    {
        /**
         * Unique alphanumeric trip code used as a business key.
         * Example: "GALR210214"
         * Acts as both an index and a uniqueness constraint to ensure
         * fast lookups and to prevent duplicate entries.
         */
        code: {
            type: String,
            required: [true, 'Trip code is required'],
            index: true,
            unique: true,
            trim: true,
        },

        /**
         * Descriptive trip name used in listings and detail views.
         */
        name: {
            type: String,
            required: [true, 'Trip name is required'],
            index: true,
            trim: true,
        },

        /**
         * Trip duration represented as text for flexible display.
         * Example: "4 nights / 5 days"
         */
        length: {
            type: String,
            required: [true, 'Trip length is required'],
            trim: true,
        },

        /**
         * Trip start date; stored as a Date object.
         * Accepts valid ISO strings or Date instances.
         */
        start: {
            type: Date,
            required: [true, 'Trip start date is required'],
        },

        /**
         * Resort or destination name where the trip takes place.
         */
        resort: {
            type: String,
            required: [true, 'Resort name is required'],
            trim: true,
        },

        /**
         * Cost per person as a string.
         * Pattern ensures valid numeric formatting with optional decimals.
         */
        perPerson: {
            type: String,
            required: [true, 'Per-person cost is required'],
            trim: true,
            match: [/^\d+(\.\d{1,2})?$/, 'Per-person value must be a valid price'],
        },

        /**
         * Filename for an associated image.
         * Typically used for trip thumbnails or banners on the front end.
         */
        image: {
            type: String,
            required: [true, 'Image filename is required'],
            trim: true,
        },

        /**
         * Rich-text HTML description shown on the front end.
         */
        description: {
            type: String,
            required: [true, 'Trip description is required'],
        },
    },
    {
        timestamps: true, // adds createdAt / updatedAt automatically
        collection: 'trips', // ensures consistent collection naming
    }
);

// -----------------------------------------------------------------------------
// Indexes
// These improve query performance on frequent filters and prevent duplicates.
// -----------------------------------------------------------------------------
tripSchema.index({ code: 1 }, { unique: true, name: 'code_unique' });
tripSchema.index({ code: 1, start: 1 }, { name: 'code_1_start_1' });

// -----------------------------------------------------------------------------
// Virtual Properties
// Provide computed fields not stored in MongoDB.
// -----------------------------------------------------------------------------
tripSchema.virtual('priceFormatted').get(function () {
    return `$${parseFloat(this.perPerson).toFixed(2)}`;
});

// -----------------------------------------------------------------------------
// Export Model
// -----------------------------------------------------------------------------
const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
