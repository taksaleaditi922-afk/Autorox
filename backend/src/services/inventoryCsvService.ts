export const INVENTORY_CSV_HEADERS = [
  'barcode', 'partName', 'partNumber', 'vehicleType', 'category', 'subCategory',
  'location', 'purchasePrice', 'sellingPrice', 'quantity', 'partType', 'remark',
  'lowStockThreshold',
];

const splitCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
};

export const parseInventoryCsv = (csv: string) => {
  const lines = String(csv || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const data = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
    return { rowNumber: index + 2, data };
  });
};

export const validateInventoryCsvRow = (entry) => {
  const row = entry.data || entry;
  const errors: string[] = [];
  if (!String(row.partName || '').trim()) errors.push('Part name is required');
  if (!String(row.partNumber || '').trim()) errors.push('Part number is required');
  if (!['2W', '4W'].includes(String(row.vehicleType || ''))) errors.push('Vehicle type must be 2W or 4W');
  if (!['OEM', 'Aftermarket', 'Other'].includes(String(row.partType || ''))) errors.push('Part type must be OEM, Aftermarket or Other');
  for (const [field, label] of [['purchasePrice', 'Purchase price'], ['sellingPrice', 'Selling price'], ['quantity', 'Quantity']] as const) {
    const value = Number(row[field]);
    if (!Number.isFinite(value) || value < 0) errors.push(`${label} must be a non-negative number`);
  }
  if (row.lowStockThreshold !== '' && row.lowStockThreshold != null && (!Number.isFinite(Number(row.lowStockThreshold)) || Number(row.lowStockThreshold) < 0)) {
    errors.push('Low stock threshold must be a non-negative number');
  }
  return errors;
};

export const inventoryCsvTemplate = () => [
  INVENTORY_CSV_HEADERS.join(','),
  '8901234567890,Front Brake Pad,BP-1001,2W,Brakes,Brake Pads,A-01,500.00,695.00,10,OEM,Front axle set,5',
].join('\n');

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const inventoryRowsToCsv = (products) => {
  const rows = products.map((product) => [
    product.barcode,
    product.productName,
    product.productCode,
    product.vehicleType,
    product.category,
    product.subCategory,
    product.inventory?.location,
    Number(product.pricing?.costPrice || 0).toFixed(2),
    Number(product.pricing?.sellingPrice || 0).toFixed(2),
    product.inventory?.quantity || 0,
    product.partType,
    product.remark,
    product.inventory?.minimumLevel ?? 5,
    product.employeeName,
  ]);
  return [
    [...INVENTORY_CSV_HEADERS, 'employeeName'].join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\n');
};
