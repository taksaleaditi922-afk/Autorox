import { Chip } from '@mui/material';
import { STATUS_COLORS } from '../constants';

export default function StatusBadge({ status }) {
  return <Chip label={status} size="small" color={STATUS_COLORS[status] || 'default'} variant="filled" />;
}