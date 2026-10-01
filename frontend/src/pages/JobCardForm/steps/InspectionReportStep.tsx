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
import type { MediaAttachment } from '../../../services/estimate/types';
import MediaUploader from '../../../components/estimate/MediaUploader';
import * as inspectionMediaService from '../../../services/jobCard/inspectionMediaService';

const CONDITION_COLORS: Record<string, string> = {
  Good: 'success.main',
  Average: 'warning.main',
  'Needs Attention': 'error.main',
  'Not Applicable': 'text.disabled',
};

export default function InspectionReportStep({ form, set, actions }: JobCardStepProps) {
  const [newItem, setNewItem] = useState('');
  const [newItemError, setNewItemError] = useState('');
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
    if (!name) {
      setNewItemError('Enter an inspection point name');
      return;
    }
    if (rows.some((row) => row.item.toLowerCase() === name.toLowerCase())) {
      setNewItemError('This inspection point already exists');
      return;
    }
    set({
      inspectionReport: [...rows, { item: name, condition: 'Good', notes: '', photoUrl: '', media: [] }],
    });
    setNewItem('');
    setNewItemError('');
  };

  const uploadPhoto = async (file: File, onProgress: (percent: number) => void) => {
    if (!actions?.ensurePersisted) throw new Error('Save the job card before attaching a photo.');
    const jobCardId = await actions.ensurePersisted();
    if (!jobCardId) throw new Error('The job card could not be saved for photo upload.');
    return inspectionMediaService.uploadInspectionPhoto(jobCardId, file, onProgress);
  };

  const mediaFor = (row: JobCardInspectionEntry, index: number): MediaAttachment[] => {
    if (row.media?.length) return row.media;
    if (!row.photoUrl) return [];
    const serverId = row.photoUrl.match(/\/documents\/([^/]+)\/file(?:\?|$)/)?.[1];
    return [{
      id: serverId || `legacy-inspection-${index}`,
      serverId,
      name: `${row.item || 'Inspection'} photo`,
      kind: 'photo',
      mimeType: 'image/*',
      size: 0,
      url: row.photoUrl,
      uploadState: 'done',
      progress: 100,
      uploadedAt: '',
    }];
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
                    <Grid item xs={10} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Technician Notes"
                        value={row.notes}
                        onChange={(e) => updateRow(index, { notes: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={2} sm={1} sx={{ textAlign: 'center' }}>
                      <Tooltip title="Remove point">
                        <IconButton size="small" onClick={() => removeRow(index)} aria-label={`Remove ${row.item}`}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12}>
                      <MediaUploader
                        media={mediaFor(row, index)}
                        estimateId={null}
                        allowVideo={false}
                        choosePhotoSource
                        multiple={false}
                        maxFiles={1}
                        disabled={actions?.saving}
                        uploadFile={uploadPhoto}
                        removeFile={inspectionMediaService.removeInspectionPhoto}
                        resolveFileUrl={inspectionMediaService.fetchInspectionPhoto}
                        onChange={(media) => {
                          const storedPhoto = media.find(
                            (item) => item.uploadState === 'done' && item.url && !item.url.startsWith('blob:')
                          );
                          updateRow(index, { media, photoUrl: storedPhoto?.url || '' });
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              addRow();
            }}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 2 }}
          >
            <TextField
              size="small"
              fullWidth
              label="Add another inspection point"
              value={newItem}
              onChange={(e) => {
                setNewItem(e.target.value);
                if (newItemError) setNewItemError('');
              }}
              error={Boolean(newItemError)}
              helperText={newItemError}
            />
            <Button type="submit" variant="outlined" startIcon={<AddIcon />} sx={{ minHeight: 40 }}>
              Add
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
