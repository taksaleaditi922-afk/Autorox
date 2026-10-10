import { connectDB, disconnectDB } from '../config/db.js';
import Product from '../models/Product.js';
import StockTransaction from '../models/StockTransaction.js';

const migrate = async () => {
  await connectDB();

  await Product.updateMany({ deletedAt: { $exists: false } }, { $set: { deletedAt: null } });
  await Product.updateMany({ partType: { $exists: false } }, { $set: { partType: 'Other' } });
  await Product.updateMany(
    { $or: [{ 'inventory.minimumLevel': { $exists: false } }, { 'inventory.minimumLevel': null }, { 'inventory.minimumLevel': 0 }] },
    { $set: { 'inventory.minimumLevel': 5 } },
  );

  const products = await Product.find({ deletedAt: null }).select('_id inventory.quantity pricing.costPrice createdAt');
  for (const product of products) {
    const movements = await StockTransaction.find({ productId: product._id, quantity: { $gt: 0 } }).sort({ createdAt: -1 });
    let remaining = Number(product.inventory?.quantity || 0);

    if (!movements.length && remaining > 0) {
      await StockTransaction.collection.insertOne({
        productId: product._id,
        transactionType: 'Legacy Opening',
        quantity: remaining,
        stockBefore: 0,
        stockAfter: remaining,
        unitPrice: product.pricing?.costPrice || 0,
        reason: 'migration',
        notes: 'Opening balance created for inventory history migration',
        remainingQuantity: remaining,
        reference: {},
        recordedBy: null,
        createdAt: product.createdAt || new Date(),
        updatedAt: new Date(),
      });
      continue;
    }

    for (const movement of movements) {
      const lotRemaining = Math.min(Math.max(remaining, 0), Math.max(movement.quantity, 0));
      await StockTransaction.updateOne({ _id: movement._id }, { $set: { remainingQuantity: lotRemaining } });
      remaining -= lotRemaining;
    }
  }

  console.log(`Inventory migration complete for ${products.length} products.`);
  await disconnectDB();
};

migrate().catch(async (error) => {
  console.error('Inventory migration failed:', error);
  await disconnectDB();
  process.exit(1);
});
