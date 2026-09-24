// ---------------------------------------------------------------------------
// Line item factories.
//
// One place turns a catalogue entry (or an inspection finding) into an estimate
// line item, so the Services step and the "Add service from inspection" flow
// produce identical shapes.
// ---------------------------------------------------------------------------

import { newId } from './id';
import type {
  CatalogLabour,
  CatalogPackage,
  CatalogPart,
  CatalogService,
  EstimateLineItem,
  InspectionCategory,
  InspectionItem,
  LineItemType,
} from '../services/estimate/types';

interface BaseFields {
  type: LineItemType;
  name: string;
  description?: string;
  unit: string;
  rate: number;
  taxRate: number;
  hsnSacCode?: string;
}

function base(fields: BaseFields, quantity = 1): EstimateLineItem {
  return {
    id: newId('item'),
    type: fields.type,
    name: fields.name,
    description: fields.description || '',
    hsnSacCode: fields.hsnSacCode || '',
    unit: fields.unit,
    quantity,
    rate: fields.rate,
    discountType: 'none',
    discountValue: 0,
    taxType: fields.taxRate > 0 ? 'GST' : 'NONE',
    taxRate: fields.taxRate,
    subtotal: 0,
    discountAmount: 0,
    taxableAmount: 0,
    taxAmount: 0,
    total: 0,
  };
}

export function lineItemFromService(service: CatalogService, quantity = 1): EstimateLineItem {
  return {
    ...base(
      {
        type: 'service',
        name: service.name,
        description: service.description,
        unit: service.unit || 'Job',
        rate: service.rate,
        taxRate: service.taxRate,
        hsnSacCode: service.hsnSacCode,
      },
      quantity
    ),
    catalogId: service.id,
  };
}

export function lineItemFromPackage(pkg: CatalogPackage, quantity = 1): EstimateLineItem {
  return {
    ...base(
      {
        type: 'package',
        name: pkg.name,
        description: pkg.description,
        unit: 'Job',
        rate: pkg.price,
        taxRate: pkg.taxRate,
      },
      quantity
    ),
    catalogId: pkg.id,
    packageContents: (pkg.contents || []).map((c) => ({ ...c })),
  };
}

export function lineItemFromPart(part: CatalogPart, quantity = 1): EstimateLineItem {
  return {
    ...base(
      {
        type: 'part',
        name: part.name,
        description: part.category ? `${part.brand} · ${part.category}` : part.brand,
        unit: part.unit || 'Pcs',
        rate: part.rate,
        taxRate: part.taxRate,
        hsnSacCode: part.hsnCode,
      },
      quantity
    ),
    catalogId: part.id,
    partNumber: part.partNumber,
    brand: part.brand,
  };
}

export function lineItemFromLabour(labour: CatalogLabour, quantity = 1): EstimateLineItem {
  return {
    ...base(
      {
        type: 'labour',
        name: labour.description,
        unit: labour.unit || 'Hour',
        rate: labour.rate,
        taxRate: labour.taxRate,
        hsnSacCode: labour.sacCode,
      },
      quantity
    ),
    catalogId: labour.id,
  };
}

/**
 * Attach the inspection provenance to a line item so the estimate can always
 * explain why the work was recommended.
 */
export function withInspectionLink(
  item: EstimateLineItem,
  category: Pick<InspectionCategory, 'id' | 'name'>,
  inspectionItem: Pick<InspectionItem, 'id' | 'name'>
): EstimateLineItem {
  return {
    ...item,
    inspectionItemId: inspectionItem.id,
    inspectionItemName: inspectionItem.name,
    inspectionCategoryName: category.name,
  };
}

export default {
  lineItemFromService,
  lineItemFromPackage,
  lineItemFromPart,
  lineItemFromLabour,
  withInspectionLink,
};
