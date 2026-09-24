// ---------------------------------------------------------------------------
// STEP 6 — Set Reminder.
//
// Follow-up reminders for the next service, insurance renewal and feedback,
// each with its own date and delivery channel. Reminders are optional.
// ---------------------------------------------------------------------------

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
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import type { JobCardReminder } from '../../../utils/jobCard';
import { REMINDER_CHANNELS, REMINDER_TYPES } from '../../../utils/jobCard';
import type { JobCardStepProps } from '../stepProps';

const CHANNEL_COLOR: Record<string, 'primary' | 'success' | 'info'> = {
  SMS: 'primary',
  WhatsApp: 'success',
  Email: 'info',
};

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function ReminderStep({ form, errors, set }: JobCardStepProps) {
  const reminders = form.reminders;

  const updateReminder = (index: number, patch: Partial<JobCardReminder>) => {
    set({ reminders: reminders.map((reminder, i) => (i === index ? { ...reminder, ...patch } : reminder)) });
  };

  const addReminder = (preset?: Partial<JobCardReminder>) => {
    set({
      reminders: [...reminders, { type: 'Next Service', dueDate: addMonths(6), channel: 'SMS', notes: '', ...preset }],
    });
  };

  const removeReminder = (index: number) => {
    set({ reminders: reminders.filter((_reminder, i) => i !== index) });
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600}>
            Reminders
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Schedule the follow-ups your team should chase. Reminders are optional — add only what is useful.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              icon={<EventAvailableIcon fontSize="small" />}
              label="Next service in 6 months"
              onClick={() => addReminder({ type: 'Next Service', dueDate: addMonths(6) })}
              variant="outlined"
            />
            <Chip
              icon={<EventAvailableIcon fontSize="small" />}
              label="Insurance renewal"
              onClick={() => addReminder({ type: 'Insurance Renewal', dueDate: form.insurance.reminderDate || addMonths(11) })}
              variant="outlined"
            />
            <Chip
              icon={<EventAvailableIcon fontSize="small" />}
              label="Feedback in 3 days"
              onClick={() => addReminder({ type: 'Feedback Request', dueDate: addDays(3), channel: 'WhatsApp' })}
              variant="outlined"
            />
          </Stack>

          <Grid container spacing={1.5}>
            {reminders.map((reminder, index) => (
              <Grid item xs={12} key={`${reminder.type}-${index}`}>
                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={1.5} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Reminder Type"
                        value={reminder.type}
                        onChange={(e) => updateReminder(index, { type: e.target.value })}
                      >
                        {REMINDER_TYPES.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Due Date"
                        InputLabelProps={{ shrink: true }}
                        value={reminder.dueDate}
                        error={Boolean(errors[`reminders.${index}.dueDate`])}
                        helperText={errors[`reminders.${index}.dueDate`]}
                        onChange={(e) => updateReminder(index, { dueDate: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={6} sm={2}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="Channel"
                        value={reminder.channel}
                        onChange={(e) => updateReminder(index, { channel: e.target.value })}
                      >
                        {REMINDER_CHANNELS.map((channel) => (
                          <MenuItem key={channel} value={channel}>
                            {channel}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={10} sm={4}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Notes"
                        value={reminder.notes || ''}
                        onChange={(e) => updateReminder(index, { notes: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={2} sm={1} sx={{ textAlign: 'center' }}>
                      <Tooltip title="Remove reminder">
                        <IconButton size="small" onClick={() => removeReminder(index)} aria-label="Remove reminder">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Button sx={{ mt: 2 }} variant="outlined" startIcon={<AddIcon />} onClick={() => addReminder()}>
            Add Reminder
          </Button>

          {reminders.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {reminders.length} reminder{reminders.length === 1 ? '' : 's'} will be queued after the job card is saved.
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                {Array.from(new Set(reminders.map((r) => r.channel))).map((channel) => (
                  <Chip key={channel} size="small" color={CHANNEL_COLOR[channel] || 'default'} label={channel} />
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
