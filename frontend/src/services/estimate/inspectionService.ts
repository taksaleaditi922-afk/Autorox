// ---------------------------------------------------------------------------
// Inspection service.
//
// Categories are configurable: the server can return its own template
// (GET /api/estimates/inspection/template) and custom categories can be added
// by the user. When the server has nothing configured the bundled template is
// used so the inspection step is never empty.
// ---------------------------------------------------------------------------

import api from '../api';
import { INSPECTION_TEMPLATE } from './config';
import { newId } from '../../utils/id';
import type { InspectionCategory, InspectionItem, InspectionStatus } from './types';

export interface InspectionTemplateItem {
  name: string;
  description?: string;
}

export interface InspectionTemplateCategory {
  id?: string;
  name: string;
  description?: string;
  sortOrder?: number;
  items: (string | InspectionTemplateItem)[];
}

export function createInspectionItem(categoryId: string, name: string): InspectionItem {
  return {
    id: newId('insp'),
    categoryId,
    name,
    status: 'na',
    notes: '',
    media: [],
    linkedServiceIds: [],
  };
}

export function createInspectionCategory(
  name: string,
  description = '',
  sortOrder?: number,
  items: string[] = []
): InspectionCategory {
  const id = newId('cat');
  return {
    id,
    name: name.trim(),
    description,
    sortOrder: sortOrder ?? 0,
    isActive: true,
    isCustom: true,
    items: items.map((item) => createInspectionItem(id, item)),
  };
}

/** Turn a server/template payload into the client inspection tree. */
export function buildCategories(template: InspectionTemplateCategory[]): InspectionCategory[] {
  return (template || []).map((category, index) => {
    const id = category.id || `cat-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return {
      id,
      name: category.name,
      description: category.description || '',
      sortOrder: category.sortOrder ?? index,
      isActive: true,
      isCustom: false,
      items: (category.items || []).map((item) => {
        const name = typeof item === 'string' ? item : item.name;
        return createInspectionItem(id, name);
      }),
    };
  });
}

/** The bundled template, ready to use. */
export function defaultCategories(): InspectionCategory[] {
  return buildCategories(
    INSPECTION_TEMPLATE.map((c, i) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: c.items,
    }))
  );
}

/** GET the configured inspection template, falling back to the bundled one. */
export async function fetchTemplate(signal?: AbortSignal): Promise<InspectionCategory[]> {
  try {
    const res = await api.get('/estimates/inspection/template', { signal });
    const categories = res.data?.data;
    if (Array.isArray(categories) && categories.length) {
      return buildCategories(categories);
    }
  } catch (err: any) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
  }
  return defaultCategories();
}

/** Persist a user defined category. Falls back to local-only on failure. */
export async function saveCategory(category: InspectionCategory): Promise<InspectionCategory> {
  try {
    const res = await api.post('/estimates/inspection/categories', {
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      items: category.items.map((i) => i.name),
    });
    const saved = res.data?.data;
    if (saved?.id || saved?._id) {
      return { ...category, id: saved.id || saved._id };
    }
  } catch {
    // A custom category only needs to exist for this estimate; the estimate
    // payload below carries it either way.
  }
  return category;
}

export interface InspectionSummary {
  total: number;
  inspected: number;
  good: number;
  attention: number;
  critical: number;
  na: number;
  /** Items that need attention or are critical, in tree order. */
  issues: {
    categoryId: string;
    categoryName: string;
    itemId: string;
    itemName: string;
    status: InspectionStatus;
    notes: string;
    mediaCount: number;
    linkedServiceIds: string[];
  }[];
}

/** Counts used by the step-2 progress bar and the review screen. */
export function summarise(categories: InspectionCategory[]): InspectionSummary {
  const summary: InspectionSummary = {
    total: 0,
    inspected: 0,
    good: 0,
    attention: 0,
    critical: 0,
    na: 0,
    issues: [],
  };

  for (const category of categories || []) {
    if (category.isActive === false) continue;
    for (const item of category.items || []) {
      summary.total += 1;
      if (item.status !== 'na') summary.inspected += 1;
      if (item.status === 'good') summary.good += 1;
      else if (item.status === 'attention') summary.attention += 1;
      else if (item.status === 'critical') summary.critical += 1;
      else summary.na += 1;

      if (item.status === 'attention' || item.status === 'critical') {
        summary.issues.push({
          categoryId: category.id,
          categoryName: category.name,
          itemId: item.id,
          itemName: item.name,
          status: item.status,
          notes: item.notes,
          mediaCount: (item.media || []).length,
          linkedServiceIds: item.linkedServiceIds || [],
        });
      }
    }
  }
  return summary;
}

export function progressPercent(categories: InspectionCategory[]): number {
  const { total, inspected } = summarise(categories);
  if (!total) return 0;
  return Math.round((inspected / total) * 100);
}

export default {
  fetchTemplate,
  defaultCategories,
  createInspectionCategory,
  createInspectionItem,
  saveCategory,
  summarise,
  progressPercent,
  buildCategories,
};
