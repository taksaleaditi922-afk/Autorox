import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import {
  downloadInventoryFile, importInventoryCsv, previewInventoryCsv,
} from '../../services/inventoryService';
import type { InventoryImportRow } from '../../services/inventoryService';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function CsvImportDialog({ open, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [filename, setFilename] = useState('');
  const [rows, setRows] = useState<InventoryImportRow[]>([]);
  const [summary, setSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setResult(null);
    setFilename(file.name);
    const text = await file.text();
    setCsv(text);
    setBusy(true);
    try {
      const preview = await previewInventoryCsv(text);
      setRows(preview.rows);
      setSummary(preview.summary);
    } catch (reason: any) {
      setError(reason?.response?.data?.error || 'Could not preview this CSV');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    setError('');
    try {
      const imported = await importInventoryCsv(csv);
      setResult(imported);
      onImported();
    } catch (reason: any) {
      setError(reason?.response?.data?.error || 'CSV import failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      saveBlob(await downloadInventoryFile('/inventory/template'), 'inventory-sample-template.csv');
    } catch {
      setError('Could not download the sample template');
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Upload Software CSV</Typography>
        <IconButton aria-label="Close" onClick={onClose} disabled={busy}><CloseIcon /></IconButton>
      </DialogTitle>
      {busy && <LinearProgress />}
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && <Alert severity={result.failed ? 'warning' : 'success'} sx={{ mb: 2 }}>Created {result.created}, updated {result.updated}, skipped {result.skipped}, failed {result.failed}.</Alert>}
        <Paper
          variant="outlined"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); }}
          sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed', mb: 2 }}
        >
          <UploadFileIcon color="primary" sx={{ fontSize: 36 }} />
          <Typography variant="body1" fontWeight={700}>{filename || 'Choose or drag an inventory CSV file'}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={() => inputRef.current?.click()}>Browse CSV</Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>Sample Template</Button>
          </Box>
          <input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => loadFile(event.target.files?.[0])} />
        </Paper>
        {summary && <Box sx={{ display: 'flex', gap: 1, mb: 2 }}><Chip label={`${summary.total} rows`} /><Chip color="success" label={`${summary.valid} valid`} /><Chip color="error" label={`${summary.invalid} invalid`} /></Box>}
        {rows.length > 0 && <TableContainer sx={{ maxHeight: 360, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Table stickyHeader size="small">
            <TableHead><TableRow><TableCell>Row</TableCell><TableCell>Part Number</TableCell><TableCell>Part Name</TableCell><TableCell>Action</TableCell><TableCell>Validation</TableCell></TableRow></TableHead>
            <TableBody>{rows.map((row) => <TableRow key={row.rowNumber} sx={{ bgcolor: row.valid ? undefined : 'error.light' }}>
              <TableCell>{row.rowNumber}</TableCell><TableCell>{row.data.partNumber}</TableCell><TableCell>{row.data.partName}</TableCell>
              <TableCell><Chip size="small" label={row.action} /></TableCell>
              <TableCell>{row.valid ? <Chip size="small" color="success" label="Valid" /> : row.errors.join('; ')}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose} disabled={busy}>Close</Button>
        <Button variant="contained" onClick={runImport} disabled={busy || !summary || summary.valid === 0}>Import {summary?.valid || 0} Valid Rows</Button>
      </DialogActions>
    </Dialog>
  );
}
