import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    preferredContactMethod: { type: String, enum: ['Email', 'SMS', 'Call'], default: 'Email' },
    assignedAdvisor: {
      advisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor', default: null },
      name: { type: String, trim: true, default: '' },
    },
    vehicles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' }],
    totalJobCards: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastServiceDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for duplicate detection & lookup
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });

customerSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    alternatePhone: this.alternatePhone,
    address: this.address,
    city: this.city,
    state: this.state,
    pincode: this.pincode,
    preferredContactMethod: this.preferredContactMethod,
    assignedAdvisor: this.assignedAdvisor,
    vehicles: this.vehicles,
    totalJobCards: this.totalJobCards,
    totalSpent: this.totalSpent,
    lastServiceDate: this.lastServiceDate,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;