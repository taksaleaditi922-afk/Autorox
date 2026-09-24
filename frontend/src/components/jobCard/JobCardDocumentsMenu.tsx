// ---------------------------------------------------------------------------
// Job card document menu.
//
// The single "print" entry point for the job card module: instead of printing
// the React page it lets the user pick which document to generate (proforma
// invoice, inspection report, work order, advance receipt, …) exactly like the
// estimate workflow. Each row can also be downloaded as a standalone file or
// shared over WhatsApp.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Box, Button, Divider, IconButton, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/uiSlice';
import {
  JOB_CARD_DOCUMENTS,
  documentNumber,
  downloadJobCardDocument,
  openDocumentOnWhatsApp,
  openJobCardDocument,
  resolveJobCardDocumentConfig,
  type JobCardDocumentConfig,
  type JobCardDocumentId,
  type JobCardDocumentOption,
} from '../../services/jobCard/documentService';

export interface JobCardDocumentsMenuProps {
  /** The job card (API document) or a form-derived job card object. */
  jobCard: any;
  /** Render a compact icon-only trigger instead of a labelled button. */
  iconOnly?: boolean;
  label?: string;
  variant?: 'text' | 'outlined' | 'contained';
  disabled?: boolean;
  /** Restrict the list, e.g. only the advance receipt from the payments dialog. */
  documents?: JobCardDocumentOption[];
  config?: Partial<JobCardDocumentConfig>;
  /** Ask the browser to print as soon as the document opens. */
  autoPrint?: boolean;
  /** Persist the invoice on the job card when a proforma invoice is issued. */
  onIssueInvoice?: (patch: { number: string; status: string; issuedAt: string }) => void;
  /** Optional extra handler after a document opens (e.g. close a dialog). */
  onOpenDocument?: (id: JobCardDocumentId) => void;
}

export default function JobCardDocumentsMenu({
  jobCard,
  iconOnly = false,
  label = 'Print',
  variant = 'outlined',
  disabled = false,
  documents = JOB_CARD_DOCUMENTS,
  config: configOverride,
  autoPrint = true,
  onIssueInvoice,
  onOpenDocument,
}: JobCardDocumentsMenuProps) {
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const config = resolveJobCardDocumentConfig(configOverride);

  const close = () => setAnchorEl(null);

  const handleOpen = (doc: JobCardDocumentOption) => {
    close();
    try {
      openJobCardDocument(doc.id, jobCard, config, { autoPrint });
      if (doc.id === 'proforma-invoice' && onIssueInvoice && !jobCard?.invoice?.number) {
        onIssueInvoice({
          number: documentNumber('proforma-invoice', jobCard),
          status: 'Issued',
          issuedAt: new Date().toISOString(),
        });
      }
      onOpenDocument?.(doc.id);
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.message || 'Could not open the document' }));
    }
  };

  const handleDownload = (doc: JobCardDocumentOption) => {
    try {
      const filename = downloadJobCardDocument(doc.id, jobCard, config);
      dispatch(showToast({ severity: 'success', message: `${doc.label} saved as ${filename}` }));
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.message || 'Could not download the document' }));
    }
  };

  const handleWhatsApp = (doc: JobCardDocumentOption) => {
    const ok = openDocumentOnWhatsApp(doc.id, jobCard, config);
    dispatch(
      showToast({
        severity: ok ? 'success' : 'error',
        message: ok
          ? `WhatsApp opened with the ${doc.label} message`
          : 'Add the customer mobile number to share the document',
      })
    );
  };

  return (
    <>
      {iconOnly ? (
        <IconButton
          size="small"
          aria-label="Print or share a document"
          aria-haspopup="menu"
          disabled={disabled}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ bgcolor: 'warning.light', color: 'warning.dark', border: 1, borderRadius: 0.75, width: 32, height: 32 }}
        >
          <PrintIcon fontSize="small" />
        </IconButton>
      ) : (
        <Button
          variant={variant}
          startIcon={<PrintIcon />}
          disabled={disabled}
          aria-haspopup="menu"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          {label}
        </Button>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 340, maxWidth: 400 } }}
      >
        <Typography variant="overline" sx={{ px: 2, pt: 1, display: 'block', color: 'text.secondary' }}>
          Generate document
        </Typography>
        <Divider sx={{ mb: 0.5 }} />
        {documents.map((doc) => (
          <MenuItem key={doc.id} onClick={() => handleOpen(doc)} sx={{ gap: 1, py: 1 }}>
            <ListItemText
              primary={doc.label}
              secondary={doc.description}
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
              secondaryTypographyProps={{ fontSize: '0.72rem' }}
              sx={{ mr: 0.5 }}
            />
            <Tooltip title="Share on WhatsApp">
              <IconButton
                size="small"
                aria-label={`Share ${doc.label} on WhatsApp`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleWhatsApp(doc);
                }}
              >
                <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton
                size="small"
                aria-label={`Download ${doc.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleDownload(doc);
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </MenuItem>
        ))}
        <Divider sx={{ mt: 0.5 }} />
        <Box sx={{ px: 2, py: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            Documents open in a new window — print or save as PDF from there.
          </Typography>
        </Box>
      </Menu>
    </>
  );
}
