import mongoose from 'mongoose';

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'];

const vehicleSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    color: { type: String, trim: true },
    fuelType: { type: String, enum: FUEL_TYPES, default: 'Petrol' },
    engineCapacity: { type: String, trim: true },
    vin: { type: String, uppercase: true, trim: true, sparse: true },
    odometerReading: { type: Number, default: 0 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    serviceHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobCard' }],
    lastServiceDate: { type: Date, default: null },
    totalServiceCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vehicleSchema.index({ make: 1, model: 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;