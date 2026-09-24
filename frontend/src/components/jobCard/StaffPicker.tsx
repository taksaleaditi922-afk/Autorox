// ---------------------------------------------------------------------------
// StaffPicker — a reusable modal to pick a supervisor or mechanic from the team.// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import type { JobCardStaff } from '../../utils/jobCard';

interface StaffPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (staff: JobCardStaff) => void;
  title: string;
  /** Optional filter: 'supervisor' | 'mechanic' | 'all' */
  role?: 'supervisor' | 'mechanic' | 'all';
  /** Pre-selected staff (for editing) */
  selected?: JobCardStaff | null;
}

export default function StaffPicker({ open, onClose, onSelect, title, role = 'all', selected }: StaffPickerProps) {
  const [query, setQuery] = useState('');
  const [staffList] = useState<StaffWithMeta[]>(getMockStaff());

  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (role !== 'all') {
      list = list.filter((s) => s.role === role);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.staffId.toLowerCase().includes(q));
    }
    return list;
  }, [staffList, query, role]);

  // Mock staff data - in production this would come from an API
  function getMockStaff(): StaffWithMeta[] {
    return [
      { staffId: 'STF001', name: 'Rajesh Kumar', role: 'supervisor', avatar: 'RK' },
      { staffId: 'STF002', name: 'Amit Sharma', role: 'supervisor', avatar: 'AS' },
      { staffId: 'STF003', name: 'Suresh Patel', role: 'mechanic', avatar: 'SP' },
      { staffId: 'STF004', name: 'Vikram Singh', role: 'mechanic', avatar: 'VS' },
      { staffId: 'STF005', name: 'Deepak Verma', role: 'mechanic', avatar: 'DV' },
      { staffId: 'STF006', name: 'Mohan Lal', role: 'mechanic', avatar: 'ML' },
      { staffId: 'STF007', name: 'Ravi Gupta', role: 'mechanic', avatar: 'RG' },
      { staffId: 'STF008', name: 'Kiran Joshi', role: 'supervisor', avatar: 'KJ' },
    ];
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>
        {title}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
        </Box>
        <List sx={{ maxHeight: 360, overflow: 'auto' }}>
          {filteredStaff.map((staff) => (
            <ListItem
              key={staff.staffId}
              button
              selected={selected?.staffId === staff.staffId}
              onClick={() => {
                onSelect(staff);
                onClose();
              }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <ListItemAvatar>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: role === 'supervisor' ? 'primary.main' : 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1rem',
                  }}
                >
                  {staff.avatar || <PersonIcon />}
                </Box>
              </ListItemAvatar>
              <ListItemText
                primary={staff.name}
                secondary={staff.staffId}
              />
              <Chip
                size="small"
                label={staff.role === 'supervisor' ? 'Supervisor' : 'Mechanic'}
                color={staff.role === 'supervisor' ? 'primary' : 'success'}
                variant="outlined"
              />
            </ListItem>
          ))}
          {filteredStaff.length === 0 && (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No staff members found
              </Typography>
            </Box>
          )}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

// Extend JobCardStaff for internal use with role/avatar
interface StaffWithMeta extends JobCardStaff {
  role: 'supervisor' | 'mechanic';
  avatar: string;
}