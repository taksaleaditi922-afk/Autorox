import mongoose from 'mongoose';

/**
 * Single-document settings store (one row, singleton).
 * Holds company profile, defaults and enabled service types.
 */
const settingsSchema = new mongoose.Schema({
  company: {
    name: { type: String, default: 'AutoGarage Workshop' },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  taxRate: { type: Number, default: 18 },
  currency: { type: String, default: 'INR' },
  serviceTypes: [
    {
      name: { type: String, required: true, trim: true },
      category: { type: String, trim: true },
      isActive: { type: Boolean, default: true },
    },
  ],
}, { timestamps: true });

settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

const Settings = mongoose.model('Settings', settingsSchema) as mongoose.Model<mongoose.InferSchemaType<typeof settingsSchema>> & { getSingleton(): Promise<any> };
export default Settings;0