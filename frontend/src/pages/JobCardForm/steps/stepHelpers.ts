export { APPROVAL_METHODS, computeOrderSummary } from '../../../utils/jobCard';

export function lineItemTypeLabel(type: string): string {
  switch (type) {
    case 'service':
      return 'Service';
    case 'package':
      return 'Package';
    case 'part':
      return 'Part';
    case 'labour':
      return 'Labour';
    default:
      return 'Custom';
  }
}
