import { Chip } from '@mui/material';
import { PRIORITY_COLORS } from '../constants';

export default function PriorityBadge({ priority }) {
  return <Chip label={priority} size="small" color={PRIORITY_COLORS[priority] || 'default'} variant="outlined" />;
}