import { MenuItem, TextField } from '@mui/material';
import { VENDOR_REQUIRED, type VendorOption } from '../../services/vendorService';
interface Props { value: string | null; onChange: (id: string | null) => void; vendors: VendorOption[]; loading?: boolean; disabled?: boolean; snapshotName?: string }
export default function VendorSelect({ value, onChange, vendors, loading, disabled, snapshotName }: Props) {
  return <TextField select fullWidth size="small" label="Vendor Name" value={value || ''} required={VENDOR_REQUIRED} disabled={disabled || loading} onChange={e => onChange(e.target.value || null)}>
    <MenuItem value="">No vendor selected</MenuItem>
    {!vendors.length && <MenuItem disabled>No vendors yet</MenuItem>}
    {value && !vendors.some(v => v.id === value) && <MenuItem value={value}>{snapshotName || 'Previous vendor (unavailable)'}</MenuItem>}
    {vendors.map(v => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
    {/* Future Vendor module extension point: replace this disabled entry with its creation flow. */}
    <MenuItem disabled>+ Add Vendor (coming soon)</MenuItem>
  </TextField>;
}
