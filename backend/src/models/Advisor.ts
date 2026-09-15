import mongoose from 'mongoose';

const advisorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    specializations: [{ type: String, trim: true }],
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
    },
    activeJobCards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobCard' }],
    totalHandled: { type: Number, default: 0 },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    isActive: { type: Boolean, default: true },
    joinDate: { type: Date, default: Date.now },
    availability: { type: String, enum: ['Busy', 'Free', 'Away'], default: 'Free' },
  },
  { timestamps: true }
);

advisorSchema.index({ email: 1 });
advisorSchema.index({ isActive: 1 });

const Advisor = mongoose.model('Advisor', advisorSchema);
export default Advisor;