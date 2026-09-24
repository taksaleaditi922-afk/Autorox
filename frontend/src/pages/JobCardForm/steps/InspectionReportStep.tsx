// ---------------------------------------------------------------------------
// STEP 2 — Inspection Report.
//
// Component checklist with condition ratings, technician notes and a photo per
// point. Rows can be added or removed; duplicate point names are ignored.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { JobCardInspectionEntry } from '../../../utils/jobCard';
import { INSPECTION_CONDITIONS } from '../../../utils/jobCard';
import type { JobCardStepProps } from '../stepProps';

const CONDITION_COLORS: Record<string, string> = {
  Good: 'success.main',
  Average: 'warning.main',
  'Needs Attention': 'error.main',
  'Not Applicable': 'text.disabled',
};

export default function InspectionReportStep({ form, set }: JobCardStepProps) {
  const [newItem, setNewItem] = useState('');
  const rows = form.inspectionReport;

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.condition] = (counts[row.condition] || 0) + 1;
    return counts;
  }, [rows]);

  const updateRow = (index: number, patch: Partial<JobCardInspectionEntry>) => {
    set({ inspectionReport: rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  };

  const removeRow = (index: number) => {
    set({ inspectionReport: rows.filter((_row, i) => i !== index) });
  };

  const addRow = () => {
    const name = newItem.trim();
    if (!name) return;
    if (rows.some((row) => row.item.toLowerCase() === name.toLowerCase())) {
      setNewItem('');
      return;
    }
    set({
      inspectionReport: [...rows, { item: name, condition: 'Good', notes: '', photoUrl: '' }],
    });
    setNewItem('');
  };

  const markAllGood = () => {
    set({
      inspectionReport: rows.map((row) =>
        row.condition === 'Not Applicable' ? row : { ...row, condition: 'Good' }
      ),
    });
  };

  const attention = (summary['Needs Attention'] || 0) + (summary.Average || 0);

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Inspection Report
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Record the condition of each component. This is optional and can be completed later.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {INSPECTION_CONDITIONS.map((condition) => (
                <Chip
                  key={condition}
                  size="small"
                  variant={condition === 'Good' ? 'filled' : 'outlined'}
                  color={condition === 'Good' ? 'success' : condition === 'Average' ? 'warning' : condition === 'Needs Attention' ? 'error' : 'default'}
                  label={`${condition}: ${summary[condition] || 0}`}
                />
              ))}
            </Stack>
          </Box>

          {attention > 0 && (
            <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>
              ⚠ {attention} item{attention === 1 ? '' : 's'} need attention — quote the repairs in the next step.
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 2, mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<CheckCircleIcon fontSize="small" />} onClick={markAllGood}>
              Mark all Good
            </Button>
          </Stack>

          <Grid container spacing={1.5}>
            {rows.map((row, index) => (
              <Grid item xs={12} key={`${row.item}-${index}`}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: row.condition === 'Needs Attention' ? 'error.light' : row.condition === 'Average' ? 'warning.light' : 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Component"
                        value={row.item}
                        onChange={(e) => updateRow(index, { item: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Condition"
                        value={row.condition}
                        onChange={(e) => updateRow(index, { condition: e.target.value })}
                      >
                        {INSPECTION_CONDITIONS.map((condition) => (
                          <MenuItem key={condition} value={condition}>
                            <Box component="span" sx={{ color: CONDITION_COLORS[condition] }}>
                              {condition}
                            </Box>
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Technician Notes"
                        value={row.notes}
                        onChange={(e) => updateRow(index, { notes: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={10} sm={2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Photo URL"
                        value={row.photoUrl || ''}
                        onChange={(e) => updateRow(index, { photoUrl: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={2} sm={1} sx={{ textAlign: 'center' }}>
                      <Tooltip title="Remove point">
                        <IconButton size="small" onClick={() => removeRow(index)} aria-label={`Remove ${row.item}`}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <TextField
              size="small"
              fullWidth
              label="Add another inspection point"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRow()}
            />
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addRow}>
              Add
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
