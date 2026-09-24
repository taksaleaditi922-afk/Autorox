// ---------------------------------------------------------------------------
// Shared, accessible primitives used across all four estimate steps.
// ---------------------------------------------------------------------------

import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormHelperText,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ButtonProps } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// ---------------------------------------------------------------------------
// SectionCard
// ---------------------------------------------------------------------------

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  /** Short explanation surfaced in a tooltip on the info icon. */
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  dense?: boolean;
  id?: string;
}

export function SectionCard({ title, subtitle, hint, action, children, dense, id }: SectionCardProps) {
  return (
    <Card id={id} sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: dense ? 2 : 2.5, '&:last-child': { pb: dense ? 2 : 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: 0 }}>
                {title}
              </Typography>
              {hint && (
                <Tooltip title={hint}>
                  <IconButton size="small" aria-label={`${title} help`} sx={{ p: 0.25 }}>
                    <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.muted' }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// StatusChip
// ---------------------------------------------------------------------------

export function StatusChip({
  label,
  color = 'default',
  size = 'small',
  icon,
}: {
  label: ReactNode;
  color?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  size?: 'small' | 'medium';
  icon?: ReactNode;
}) {
  return (
    <Chip
      label={label}
      color={color}
      size={size}
      icon={icon as any}
      sx={{ fontWeight: 700 }}
      variant={color === 'default' ? 'outlined' : 'filled'}
    />
  );
}

// ---------------------------------------------------------------------------
// FieldError — inline, announced to screen readers
// ---------------------------------------------------------------------------

export function FieldError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <FormHelperText error sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {error}
    </FormHelperText>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 5,
        px: 2,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.subtle',
      }}
    >
      {icon}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: icon ? 1 : 0 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog — replaces window.confirm for destructive actions
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth aria-labelledby="confirm-dialog-title">
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          color={destructive ? 'error' : 'primary'}
          variant="contained"
          disabled={busy}
          autoFocus
        >
          {busy ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// LoadingButton — keeps the action visible while a request is in flight
// ---------------------------------------------------------------------------

export function LoadingButton({ loading, children, disabled, ...rest }: ButtonProps & { loading?: boolean }) {
  return (
    <Button {...rest} disabled={disabled || loading} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : rest.startIcon}>
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Inline alert used for recoverable failures and hints
// ---------------------------------------------------------------------------

export function InlineAlert({
  severity = 'info',
  children,
  action,
  onClose,
}: {
  severity?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
  action?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <Alert severity={severity} onClose={onClose} sx={{ mb: 2 }} action={action}>
      {children}
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Key/value summary row (used by every review section)
// ---------------------------------------------------------------------------

export function SummaryRow({
  label,
  value,
  divider,
  emphasize,
}: {
  label: ReactNode;
  value: ReactNode;
  divider?: boolean;
  emphasize?: boolean;
}) {
  return (
    <>
      {divider && <Divider sx={{ my: 0.5 }} />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, py: 0.4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={emphasize ? 800 : 600}
          sx={{ textAlign: 'right', wordBreak: 'break-word' }}
        >
          {value}
        </Typography>
      </Box>
    </>
  );
}

/** Grid of key/value pairs used by the vehicle + customer summaries. */
export function SummaryGrid({
  items,
  columns = { xs: 1, sm: 2 },
}: {
  items: { label: string; value: ReactNode }[];
  columns?: { xs?: number; sm?: number; md?: number };
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: `repeat(${columns.xs ?? 1}, minmax(0, 1fr))`,
          sm: `repeat(${columns.sm ?? 2}, minmax(0, 1fr))`,
          ...(columns.md ? { md: `repeat(${columns.md}, minmax(0, 1fr))` } : {}),
        },
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.muted" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            {item.label}
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
            {item.value || '—'}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default {
  SectionCard,
  StatusChip,
  FieldError,
  EmptyState,
  ConfirmDialog,
  LoadingButton,
  InlineAlert,
  SummaryRow,
  SummaryGrid,
};
