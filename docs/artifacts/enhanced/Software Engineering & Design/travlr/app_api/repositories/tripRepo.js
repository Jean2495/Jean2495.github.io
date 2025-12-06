const Trip = require('../models/travlr');

exports.findAll = () => Trip.find({}).exec();
exports.findByCode = (code) => Trip.findOne({ code }).exec();
exports.create = (data) => new Trip(data).save();
exports.updateByCode = (code, data) => Trip.findOneAndUpdate({ code }, data, { new: true }).exec();
