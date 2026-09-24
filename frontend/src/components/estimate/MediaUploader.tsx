// ---------------------------------------------------------------------------
// <MediaUploader /> — photos and videos for an inspection point.
//
// Owns the upload lifecycle (pick -> validate -> optimistic thumbnail ->
// progress -> uploaded / failed + retry) and reports the whole array back
// through onChange, so the parent only has to persist it.
//
// On mobile the photo input uses capture="environment" so the browser opens the
// camera directly.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/uiSlice';
import * as mediaService from '../../services/estimate/mediaService';
import { UPLOAD_RULES } from '../../services/estimate/config';
import type { MediaAttachment } from '../../services/estimate/types';
import MediaPreview from './MediaPreview';

export interface MediaUploaderProps {
  media: MediaAttachment[];
  onChange: (media: MediaAttachment[]) => void;
  /** Draft id — required for a real upload; falls back to local-only previews. */
  estimateId: string | null;
  scope?: string;
  itemId?: string;
  allowVideo?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export default function MediaUploader({
  media,
  onChange,
  estimateId,
  scope = 'inspection',
  itemId,
  allowVideo = true,
  disabled,
  compact,
}: MediaUploaderProps) {
  const dispatch = useDispatch();
  const photoInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const replace = (id: string, patch: Partial<MediaAttachment>) => {
    onChange(media.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const runUpload = async (pending: MediaAttachment) => {
    if (!pending.file) {
      replace(pending.id, { uploadState: 'error', error: 'File is no longer available in this session' });
      return;
    }
    replace(pending.id, { uploadState: 'uploading', progress: 0, error: undefined });
    try {
      const uploaded = await mediaService.uploadMedia(pending.file, { estimateId, scope, itemId }, (percent) => {
        replace(pending.id, { progress: percent });
      });
      // A local-only fallback means the draft isn't persisted yet.
      if (uploaded.uploadState === 'error') {
        replace(pending.id, { uploadState: 'error', error: uploaded.error });
        return;
      }
      replace(pending.id, {
        ...uploaded,
        id: pending.id,
        file: undefined,
      });
    } catch (err: any) {
      replace(pending.id, { uploadState: 'error', error: err?.message || 'Upload failed. Try again.' });
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const accepted: MediaAttachment[] = [];
    let firstError: string | null = null;

    for (const file of Array.from(files)) {
      const kind = file.type.startsWith('video/') ? 'video' : 'photo';
      const validation = mediaService.validateFile(file, kind);
      if (!validation.ok) {
        if (!firstError) firstError = validation.error || 'Unsupported file';
        continue;
      }
      accepted.push(mediaService.createPendingAttachment(file));
    }

    if (accepted.length) {
      onChange([...media, ...accepted]);
      // Upload sequentially so a slow mobile connection isn't saturated.
      for (const item of accepted) {
        await runUpload(item);
      }
    }
    setBusy(false);
    if (firstError) dispatch(showToast({ severity: 'error', message: firstError }));
    if (photoInput.current) photoInput.current.value = '';
    if (videoInput.current) videoInput.current.value = '';
  };

  const remove = (item: MediaAttachment) => {
    onChange(media.filter((m) => m.id !== item.id));
    mediaService.revokeObjectUrl(item.url);
    void mediaService.removeMedia(item.serverId, estimateId);
  };

  const resolveUrl = async (item: MediaAttachment) => {
    if (!estimateId || !item.serverId) throw new Error('Preview unavailable');
    return mediaService.fetchMediaBlobUrl(estimateId, item.serverId);
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Media
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: media.length ? 1.5 : 0 }}>
        <input
          ref={photoInput}
          type="file"
          accept={UPLOAD_RULES.photos.accept}
          capture="environment"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {allowVideo && (
          <input
            ref={videoInput}
            type="file"
            accept={UPLOAD_RULES.videos.accept}
            capture="environment"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddPhotoAlternateOutlinedIcon fontSize="small" />}
          onClick={() => photoInput.current?.click()}
          disabled={disabled || busy}
        >
          Add Photo
        </Button>
        {allowVideo && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<VideocamOutlinedIcon fontSize="small" />}
            onClick={() => videoInput.current?.click()}
            disabled={disabled || busy}
          >
            Add Video
          </Button>
        )}
      </Stack>

      <MediaPreview items={media} resolveUrl={resolveUrl} onRemove={compact ? undefined : remove} onRetry={(item) => runUpload(item as MediaAttachment)} size={compact ? 64 : 84} />

      {!estimateId && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
          Save the draft to store this media on the server. Thumbnails stay available in this session.
        </Typography>
      )}
    </Box>
  );
}
