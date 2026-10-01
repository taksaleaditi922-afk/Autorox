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

import { useEffect, useRef, useState } from 'react';
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
  /** Optional storage adapter used by flows other than Estimate. */
  uploadFile?: (file: File, onProgress: (percent: number) => void) => Promise<MediaAttachment>;
  removeFile?: (item: MediaAttachment) => void | Promise<void>;
  resolveFileUrl?: (item: MediaAttachment) => Promise<string>;
  /** Show separate camera and device actions instead of the single photo action. */
  choosePhotoSource?: boolean;
  multiple?: boolean;
  maxFiles?: number;
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
  uploadFile,
  removeFile,
  resolveFileUrl,
  choosePhotoSource = false,
  multiple = true,
  maxFiles,
}: MediaUploaderProps) {
  const dispatch = useDispatch();
  const photoInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const mediaRef = useRef(media);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  const commit = (next: MediaAttachment[]) => {
    mediaRef.current = next;
    onChange(next);
  };

  const replace = (id: string, patch: Partial<MediaAttachment>) => {
    commit(mediaRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const runUpload = async (pending: MediaAttachment) => {
    if (!pending.file) {
      replace(pending.id, { uploadState: 'error', error: 'File is no longer available in this session' });
      return;
    }
    replace(pending.id, { uploadState: 'uploading', progress: 0, error: undefined });
    try {
      const uploaded = uploadFile
        ? await uploadFile(pending.file, (percent) => replace(pending.id, { progress: percent }))
        : await mediaService.uploadMedia(pending.file, { estimateId, scope, itemId }, (percent) => {
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
    const remaining = maxFiles === undefined ? files.length : Math.max(0, maxFiles - mediaRef.current.length);

    for (const file of Array.from(files).slice(0, multiple ? remaining : Math.min(1, remaining))) {
      const kind = file.type.startsWith('video/') ? 'video' : 'photo';
      const validation = mediaService.validateFile(file, kind);
      if (!validation.ok) {
        if (!firstError) firstError = validation.error || 'Unsupported file';
        continue;
      }
      accepted.push(mediaService.createPendingAttachment(file));
    }

    if (accepted.length) {
      commit([...mediaRef.current, ...accepted]);
      // Upload sequentially so a slow mobile connection isn't saturated.
      for (const item of accepted) {
        await runUpload(item);
      }
    }
    setBusy(false);
    if (firstError) dispatch(showToast({ severity: 'error', message: firstError }));
    if (photoInput.current) photoInput.current.value = '';
    if (cameraInput.current) cameraInput.current.value = '';
    if (videoInput.current) videoInput.current.value = '';
  };

  const remove = (item: MediaAttachment) => {
    commit(mediaRef.current.filter((m) => m.id !== item.id));
    mediaService.revokeObjectUrl(item.url);
    if (removeFile) {
      void Promise.resolve(removeFile(item)).catch(() => {
        dispatch(showToast({ severity: 'error', message: 'The file was removed here but could not be deleted from storage.' }));
      });
    } else void mediaService.removeMedia(item.serverId, estimateId);
  };

  const resolveUrl = async (item: MediaAttachment) => {
    if (resolveFileUrl) return resolveFileUrl(item);
    if (!estimateId || !item.serverId) throw new Error('Preview unavailable');
    return mediaService.fetchMediaBlobUrl(estimateId, item.serverId);
  };

  const atLimit = maxFiles !== undefined && media.length >= maxFiles;

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
          multiple={multiple}
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {choosePhotoSource && (
          <input
            ref={cameraInput}
            type="file"
            accept={UPLOAD_RULES.photos.accept}
            capture="environment"
            multiple={false}
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        )}
        {allowVideo && (
          <input
            ref={videoInput}
            type="file"
            accept={UPLOAD_RULES.videos.accept}
            capture="environment"
            multiple={multiple}
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        )}
        {choosePhotoSource && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddPhotoAlternateOutlinedIcon fontSize="small" />}
            onClick={() => cameraInput.current?.click()}
            disabled={disabled || busy || atLimit}
          >
            Take Photo
          </Button>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddPhotoAlternateOutlinedIcon fontSize="small" />}
          onClick={() => photoInput.current?.click()}
          disabled={disabled || busy || atLimit}
        >
          {choosePhotoSource ? 'Choose from Device' : 'Add Photo'}
        </Button>
        {allowVideo && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<VideocamOutlinedIcon fontSize="small" />}
            onClick={() => videoInput.current?.click()}
            disabled={disabled || busy || atLimit}
          >
            Add Video
          </Button>
        )}
      </Stack>

      <MediaPreview items={media} resolveUrl={resolveUrl} onRemove={compact ? undefined : remove} onRetry={(item) => runUpload(item as MediaAttachment)} size={compact ? 64 : 84} />

      {!estimateId && !uploadFile && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
          Save the draft to store this media on the server. Thumbnails stay available in this session.
        </Typography>
      )}
    </Box>
  );
}
