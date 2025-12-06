/* Travlr Trip Schema
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
        code: {
            type: String,
            required: [true, 'Trip code is required'],
            index: true,
            unique: true,
            trim: true,
        },

        name: {
            type: String,
            required: [true, 'Trip name is required'],
            index: true,
            trim: true,
        },

        length: {
            type: String,
            required: [true, 'Trip length is required'],
            trim: true,
        },

        start: {
            type: Date,
            required: [true, 'Trip start date is required'],
        },

        resort: {
            type: String,
            required: [true, 'Resort name is required'],
            trim: true,
        },

        perPerson: {
            type: String,
            required: [true, 'Per-person cost is required'],
            trim: true,
            match: [/^\d+(\.\d{1,2})?$/, 'Per-person value must be a valid price'],
        },

        image: {
            type: String,
            required: [true, 'Image filename is required'],
            trim: true,
        },

        description: {
            type: String,
            required: [true, 'Trip description is required'],
        },
    },
    {
        timestamps: true,
        collection: 'trips',
    }
);

// -----------------------------------------------------------------------------
// Indexes
// -----------------------------------------------------------------------------
tripSchema.index({ code: 1 }, { unique: true, name: 'code_unique' });
tripSchema.index({ code: 1, start: 1 }, { name: 'code_1_start_1' });
tripSchema.index({ resort: 1, start: 1 }, { name: 'resort_1_start_1' });

// NEW: enhances analytics involving prices
tripSchema.index({ perPerson: 1 }, { name: 'perPerson_price_idx' });

// -----------------------------------------------------------------------------
// Static Analytics Method
// -----------------------------------------------------------------------------
tripSchema.statics.getAnalytics = function () {
    return this.aggregate([
        {
            $group: {
                _id: '$resort',
                totalTrips: { $sum: 1 },
                averagePerPerson: { $avg: { $toDouble: '$perPerson' } },
            },
        },
        { $sort: { totalTrips: -1 } },
    ]);
};

// -----------------------------------------------------------------------------
// Virtual Properties
// -----------------------------------------------------------------------------
tripSchema.virtual('priceFormatted').get(function () {
    return `$${parseFloat(this.perPerson).toFixed(2)}`;
});

// -----------------------------------------------------------------------------
// Export Model
// -----------------------------------------------------------------------------
const Trip = mongoose.model('Trip', tripSchema);
module.exports = Trip;
