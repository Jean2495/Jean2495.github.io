const repo = require('../repositories/tripRepo');

exports.list = () => repo.findAll();

exports.getByCode = async (code) => {
    const doc = await repo.findByCode(code);
    return doc; // null if not found; controller decides status code
};

exports.add = (payload) => repo.create(payload);

exports.update = (code, payload) => repo.updateByCode(code, payload);
