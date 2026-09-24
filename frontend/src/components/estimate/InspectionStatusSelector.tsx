// ---------------------------------------------------------------------------
// Inspection status selector.
//
// Status is communicated with a label, an icon AND colour so it never relies on
// colour alone (WCAG 1.4.1). The control is a ToggleButtonGroup, which is fully
// keyboard navigable and announces the pressed state.
// ---------------------------------------------------------------------------

import { ToggleButton, ToggleButtonGroup, Box, Typography } from '@mui/material';
import { INSPECTION_STATUS_META, INSPECTION_STATUSES } from '../../services/estimate/config';
import type { InspectionStatus } from '../../services/estimate/types';

export interface InspectionStatusSelectorProps {
  value: InspectionStatus;
  onChange: (status: InspectionStatus) => void;
  name: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  /** Hide the visible label when space is tight (the aria-label stays). */
  compact?: boolean;
}

export default function InspectionStatusSelector({
  value,
  onChange,
  name,
  disabled,
  size = 'small',
  compact,
}: InspectionStatusSelectorProps) {
  return (
    <Box>
      {!compact && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          Status
        </Typography>
      )}
      <ToggleButtonGroup
        value={value}
        exclusive
        size={size}
        disabled={disabled}
        onChange={(_event, next: InspectionStatus | null) => {
          if (next) onChange(next);
        }}
        aria-label={`${name} condition`}
        sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButtonGroup-grouped': { border: '1px solid', borderColor: 'divider', borderRadius: '10px !important', m: 0 } }}
      >
        {INSPECTION_STATUSES.map((status) => {
          const meta = INSPECTION_STATUS_META[status];
          return (
            <ToggleButton
              key={status}
              value={status}
              aria-label={`${name}: ${meta.label}`}
              sx={{
                px: 1.25,
                py: 0.4,
                gap: 0.5,
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: meta.hex,
                  borderColor: meta.hex,
                  bgcolor: `${meta.hex}14`,
                  '&:hover': { bgcolor: `${meta.hex}22` },
                },
              }}
            >
              <Box component="span" aria-hidden="true" sx={{ fontSize: '0.8rem', lineHeight: 1 }}>
                {meta.icon}
              </Box>
              {meta.label}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}
