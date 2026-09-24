// ---------------------------------------------------------------------------
// <DocumentUploader /> — single document slot (insurance policy, ID proof).
//
// Supports upload, preview, replace and delete with progress, and never links
// to a public file path: previews are resolved through the authenticated media
// endpoint into a temporary blob URL.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/uiSlice';
import * as mediaService from '../../services/estimate/mediaService';
import { UPLOAD_RULES } from '../../services/estimate/config';
import type { UploadedDocument } from '../../services/estimate/types';
import MediaPreview from './MediaPreview';

export interface DocumentUploaderProps {
  document: UploadedDocument | null;
  onChange: (document: UploadedDocument | null) => void;
  estimateId: string | null;
  scope: string;
  label?: string;
  disabled?: boolean;
}

export default function DocumentUploader({
  document,
  onChange,
  estimateId,
  scope,
  label = 'Document',
  disabled,
}: DocumentUploaderProps) {
  const dispatch = useDispatch();
  const input = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pick = () => input.current?.click();

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const validation = mediaService.validateFile(file, 'document');
    if (!validation.ok) {
      dispatch(showToast({ severity: 'error', message: validation.error || 'Unsupported file' }));
      if (input.current) input.current.value = '';
      return;
    }

    setUploading(true);
    setProgress(0);
    const result = await mediaService.uploadDocument(
      file,
      { estimateId, scope },
      (percent) => setProgress(percent)
    );
    setUploading(false);
    onChange(result);
    if (input.current) input.current.value = '';

    if (result.uploadState === 'error') {
      dispatch(showToast({ severity: 'error', message: result.error || 'Upload failed. Try again.' }));
    } else {
      dispatch(showToast({ severity: 'success', message: `${label} uploaded` }));
    }
  };

  const resolveUrl = async (item: UploadedDocument) => {
    // A blob URL means the file is only in this session.
    if (item.url?.startsWith('blob:')) return item.url;
    if (!estimateId || !item.id) throw new Error('Preview unavailable');
    return mediaService.fetchMediaBlobUrl(estimateId, item.id);
  };

  const view = async () => {
    if (!document) return;
    try {
      // Documents are never public: preview through the authenticated endpoint.
      const url = await resolveUrl(document);
      window.open(url, '_blank', 'noopener');
    } catch {
      dispatch(showToast({ severity: 'error', message: 'Preview unavailable. Save the draft and try again.' }));
    }
  };

  const remove = () => {
    mediaService.revokeObjectUrl(document?.url);
    void mediaService.removeMedia(document?.id, estimateId);
    onChange(null);
  };

  const failed = document?.uploadState === 'error';

  return (
    <Box>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_RULES.documents.accept}
        hidden
        onChange={(e) => handleFile(e.target.files)}
      />

      {!document || failed ? (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: failed ? 'error.main' : 'divider',
            borderRadius: 2.5,
            p: 2,
            textAlign: 'center',
            bgcolor: 'background.subtle',
          }}
        >
          <InsertDriveFileOutlinedIcon color="action" />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {failed ? document?.error || 'Upload failed. Try again.' : `PDF, JPG or PNG up to ${UPLOAD_RULES.documents.maxSizeMb} MB`}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon fontSize="small" />} onClick={pick} disabled={disabled || uploading}>
            {failed ? 'Try again' : `Upload ${label}`}
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.5 }}>
          <MediaPreview items={[document]} resolveUrl={resolveUrl} size={56} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={document.name}>
              {document.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {mediaService.formatFileSize(document.size)} · uploaded {new Date(document.uploadedAt).toLocaleDateString('en-IN')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              onClick={() => void view()}
              startIcon={<VisibilityOutlinedIcon fontSize="small" />}
            >
              View
            </Button>
            <Button size="small" onClick={pick} startIcon={<SwapHorizOutlinedIcon fontSize="small" />} disabled={disabled}>
              Replace
            </Button>
            <Button size="small" color="error" onClick={remove} startIcon={<DeleteOutlineIcon fontSize="small" />} disabled={disabled}>
              Delete
            </Button>
          </Stack>
        </Box>
      )}

      {uploading && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress variant="determinate" value={progress} aria-label={`Uploading ${label}`} />
          <Typography variant="caption" color="text.secondary">
            Uploading… {progress}%
          </Typography>
        </Box>
      )}
    </Box>
  );
}
