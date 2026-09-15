import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Advisor from '../models/Advisor.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import JobCard, { JOB_STATUS } from '../models/JobCard.js';
import { generateJobCardNumber } from '../utils/generators.js';

const seed = async () => {
  await connectDB();

  // Clean existing demo data (idempotent)
  await Promise.all([
    User.deleteMany({}),
    Advisor.deleteMany({}),
    Customer.deleteMany({}),
    Vehicle.deleteMany({}),
    JobCard.deleteMany({}),
  ]);

  // Admin user
  const salt = await bcrypt.genSalt(10);
  await User.create({
    username: 'admin',
    email: env.seedAdminEmail,
    password: env.seedAdminPassword,
    role: 'Admin',
    isActive: true,
  });
  console.log('Created admin:', env.seedAdminEmail, '/', env.seedAdminPassword);

  // Advisors
  const advisorSeed = [
    { name: 'Mike Johnson', email: 'mike@autorox.in', phone: '9123456789', specializations: ['Engine Repair', 'Transmission'], availability: 'Free' },
    { name: 'Sara Fernandes', email: 'sara@autorox.in', phone: '9123456790', specializations: ['Paint', 'Detailing'], availability: 'Busy' },
    { name: 'Rajesh Kumar', email: 'rajesh@autorox.in', phone: '9123456791', specializations: ['Maintenance', 'Inspection'], availability: 'Free' },
  ];
  const advisors = await Advisor.insertMany(advisorSeed);
  console.log(`Created ${advisors.length} advisors`);

  await User.create({
    username: 'sara',
    email: 'sara@autorox.in',
    password: 'sara123',
    role: 'Service Advisor',
    advisorId: advisors[1]._id,
  });

  // Customers
  const customerSeed = [
    { name: 'John Doe', email: 'john@example.com', phone: '9876543210', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', preferredContactMethod: 'Email' },
    { name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543211', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', preferredContactMethod: 'Call' },
    { name: 'Amit Patel', email: 'amit@example.com', phone: '9876543212', city: 'Pune', state: 'Maharashtra', pincode: '411001', preferredContactMethod: 'SMS' },
  ];
  const customers = await Customer.insertMany(customerSeed);
  console.log(`Created ${customers.length} customers`);

  // Vehicles
  const vehicleData = [
    { registrationNumber: 'MH-01-AB-1234', make: 'Maruti', model: 'Swift', year: 2022, color: 'Silver', fuelType: 'Petrol', engineCapacity: '1200cc', odometerReading: 45000, owner: customers[0]._id },
    { registrationNumber: 'MH-12-CD-5678', make: 'Hyundai', model: 'Creta', year: 2021, color: 'White', fuelType: 'Diesel', engineCapacity: '1500cc', odometerReading: 62000, owner: customers[1]._id },
    { registrationNumber: 'MH-14-EF-9101', make: 'Tata', model: 'Nexon', year: 2023, color: 'Blue', fuelType: 'Petrol', engineCapacity: '1200cc', odometerReading: 30000, owner: customers[2]._id },
  ];
  const vehicles = await Vehicle.insertMany(vehicleData);
  console.log(`Created ${vehicles.length} vehicles`);

  // Sample job cards with various statuses/priorities
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const jobCardSeed = [
    {
      vehicle: { registrationNumber: 'MH-01-AB-1234', make: 'Maruti', model: 'Swift', year: 2022, color: 'Silver', fuelType: 'Petrol', odometerReading: 45000 },
      customer: { customerId: customers[0]._id, name: 'John Doe', email: 'john@example.com', phone: '9876543210', address: '123 Main St, Mumbai' },
      service: { type: 'Maintenance', description: 'Periodic 50k service - oil change, filters, brake inspection', priority: 'Medium', estimatedDelivery: new Date(now + 3 * day) },
      advisor: { advisorId: advisors[2]._id, name: 'Rajesh Kumar' },
      status: JOB_STATUS.IN_PROGRESS,
      createdAt: new Date(now - 5 * day),
    },
    {
      vehicle: { registrationNumber: 'MH-12-CD-5678', make: 'Hyundai', model: 'Creta', year: 2021, color: 'White', fuelType: 'Diesel', odometerReading: 62000 },
      customer: { customerId: customers[1]._id, name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543211', address: '42 Bandra, Mumbai' },
      service: { type: 'Repair', description: 'AC compressor not cooling - inspect and replace if required', priority: 'Urgent', estimatedDelivery: new Date(now + 1 * day) },
      insurance: { isClaim: true, companyName: 'XYZ Insurance', claimNumber: 'CLM-2026-001', accidentDate: new Date(now - 2 * day), accidentDescription: 'Front impact collision' },
      advisor: { advisorId: advisors[0]._id, name: 'Mike Johnson' },
      status: JOB_STATUS.PENDING_APPROVAL,
      createdAt: new Date(now - 2 * day),
    },
    {
      vehicle: { registrationNumber: 'MH-14-EF-9101', make: 'Tata', model: 'Nexon', year: 2023, color: 'Blue', fuelType: 'Petrol', odometerReading: 30000 },
      customer: { customerId: customers[2]._id, name: 'Amit Patel', email: 'amit@example.com', phone: '9876543212', address: '88 FC Road, Pune' },
      service: { type: 'Paint', description: 'Front bumper repaint and scratch removal on passenger door', priority: 'Low', estimatedDelivery: new Date(now - 1 * day), actualDelivery: new Date(now - 2 * day) },
      advisor: { advisorId: advisors[1]._id, name: 'Sara Fernandes' },
      status: JOB_STATUS.DELIVERED,
      createdAt: new Date(now - 10 * day),
    },
  ];

  let i = 0;
  for (const data of jobCardSeed) {
    const card = new JobCard({
      ...data,
      jobCardNumber: generateJobCardNumber(),
      statusHistory: [{ status: data.status, changedBy: 'seed', changedAt: new Date(), notes: 'Seed data' }],
      audit: [{ action: 'Created (seed)', by: 'seed', at: new Date() }],
    });
    await card.save();
    const ci = i;
    const cu = customers[ci];
    const v = vehicles[ci];
    await Customer.findByIdAndUpdate(cu._id, {
      $inc: { totalJobCards: 1 },
      lastServiceDate: data.service.actualDelivery || data.createdAt,
    });
    if (v) {
      v.serviceHistory.push(card._id);
      v.totalServiceCount = 1;
      v.lastServiceDate = new Date();
      await v.save();
    }
    i += 1;
  }
  console.log(`Created ${jobCardSeed.length} sample job cards`);

  console.log('Seed complete.');
  await disconnectDB();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});