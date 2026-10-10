import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['Admin', 'Service Manager', 'Service Advisor', 'Viewer'];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'Service Advisor' },
    advisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor', default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    advisorId: this.advisorId,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
  };
};

const User = mongoose.model('User', userSchema) as mongoose.Model<mongoose.InferSchemaType<typeof userSchema>, {}, { matchPassword(password: string): Promise<boolean>; toSafeJSON(): any }>;
export default User;