// ---------------------------------------------------------------------------
// <ServiceLinkModal /> — raise a service straight from an inspection finding.
//
// The line item it creates keeps `inspectionItemId`, so the final estimate can
// always explain *why* a service was recommended.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { formatCurrency } from '../../utils/format';
import { useDebounce } from '../../utils/useDebounce';
import * as catalogService from '../../services/estimate/catalogService';
import { INSPECTION_STATUS_META } from '../../services/estimate/config';
import type { CatalogService, InspectionStatus } from '../../services/estimate/types';
import { StatusChip } from './primitives';

export interface InspectionTarget {
  categoryId: string;
  categoryName: string;
  itemId: string;
  itemName: string;
  status: InspectionStatus;
}

export interface ServiceLinkModalProps {
  open: boolean;
  target: InspectionTarget | null;
  onAdd: (service: CatalogService, quantity: number) => void;
  onClose: () => void;
}

export default function ServiceLinkModal({ open, target, onAdd, onClose }: ServiceLinkModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [results, setResults] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounced = useDebounce(query, 300);

  const suggested = target ? catalogService.suggestServicesFor(target.itemName, 5) : [];

  useEffect(() => {
    if (!open) {
      setQuery('');
      setQuantity(1);
      setResults([]);
      setLoading(false);
      return;
    }
    if (!debounced || debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    catalogService
      .searchServices(
        { q: debounced, category: '', brand: '', minPrice: '', maxPrice: '', page: 1, limit: 10 },
        controller.signal
      )
      .then((res) => setResults(res.data as CatalogService[]))
      .catch((err) => {
        if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') setResults([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debounced, open]);

  const list = debounced.trim().length >= 2 ? results : suggested;
  const heading = debounced.trim().length >= 2 ? 'Search results' : 'Suggested services';

  const add = (service: CatalogService) => {
    onAdd(service, quantity);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      aria-labelledby="service-link-dialog-title"
    >
      <DialogTitle id="service-link-dialog-title" sx={{ pb: 1 }}>
        Add Service
        {target && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {target.categoryName} — {target.itemName}
            </Typography>
            <StatusChip label={INSPECTION_STATUS_META[target.status].label} color={INSPECTION_STATUS_META[target.status].color as any} />
          </Box>
        )}
      </DialogTitle>

      <DialogContent dividers>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Search service"
          placeholder="Brake Pad Replacement"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
            {heading}
          </Typography>
          <Divider sx={{ flexGrow: 1 }} />
          <TextField
            size="small"
            type="number"
            label="Qty"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            sx={{ width: 84 }}
            inputProps={{ min: 1, step: '0.5', 'aria-label': 'Quantity to add' }}
          />
        </Box>

        {loading ? (
          <Box sx={{ mt: 1 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={56} sx={{ my: 0.5 }} />
            ))}
          </Box>
        ) : list.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            No services matched “{debounced}”. Try another term — or add a custom item in Step 3.
          </Typography>
        ) : (
          <List dense sx={{ mt: 1 }} aria-label={heading}>
            {list.map((service) => (
              <ListItem
                key={service.id}
                divider
                secondaryAction={
                  <Button size="small" variant="outlined" startIcon={<AddIcon fontSize="small" />} onClick={() => add(service)}>
                    Add
                  </Button>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight={700}>
                        {service.name}
                      </Typography>
                      <Chip label={service.category} size="small" variant="outlined" />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {formatCurrency(service.rate)} per {service.unit} · {service.taxRate}% GST
                      {service.hsnSacCode ? ` · SAC ${service.hsnSacCode}` : ''}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ display: 'none' }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
