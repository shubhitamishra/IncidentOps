const mongoose = require('mongoose');

const onCallMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  rotationOrder: { type: Number, required: true }, // 0,1,2... determines rotation sequence
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model('OnCallMember', onCallMemberSchema);
