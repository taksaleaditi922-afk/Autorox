// Navigation items for the sidebar
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: 'Dashboard' },
  { label: 'Job Cards', path: '/jobcards', icon: 'Assignment' },
  { label: 'New Job Card', path: '/jobcards/new', icon: 'AddCard' },
  { label: 'Estimates', path: '/estimates', icon: 'Receipt' },
  { label: 'Sell Products', path: '/sell', icon: 'ShoppingCart' },
  { label: 'Customers', path: '/customers', icon: 'People' },
  { label: 'Vehicles', path: '/vehicles', icon: 'DirectionsCar' },
  { label: 'Advisors', path: '/advisors', icon: 'SupportAgent' },
  { label: 'Reports', path: '/reports', icon: 'Assessment' },
  { label: 'Settings', path: '/settings', icon: 'Settings' },
];

export const STATUS_COLORS = {
  New: 'info',
  'In Progress': 'warning',
  'Pending Parts': 'warning',
  'Pending Approval': 'secondary',
  'Ready for Delivery': 'info',
  Delivered: 'success',
  'On Hold': 'error',
  Cancelled: 'error',
};

export const PRIORITY_COLORS = {
  Low: 'success',
  Medium: 'info',
  High: 'warning',
  Urgent: 'error',
};

export const SALE_STATUSES = ['Invoice', 'Pending', 'Paid', 'Cancelled'];
export const SALE_STATUS_COLORS = {
  Invoice: 'info',
  Pending: 'warning',
  Paid: 'success',
  Cancelled: 'error',
};

export const PAYMENT_METHODS = ['Cash', 'Card', 'Online', 'Cheque'];
export const TAX_RATE = 18;
export const PRODUCTS_PER_PAGE = 20;
export const BILL_PREFIX = 'BIL';
