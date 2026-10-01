// ---------------------------------------------------------------------------
// <MediaPreview /> — thumbnail grid with a lightbox.
//
// Thumbnails use the local object URL while a file is still in this browser
// session. Once the file lives on the server it is fetched through the
// authenticated media endpoint and turned into a temporary blob URL, so
// documents are never exposed on a public path.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { formatFileSize } from '../../services/estimate/mediaService';
import type { MediaAttachment, UploadedDocument } from '../../services/estimate/types';

type PreviewItem = MediaAttachment | UploadedDocument;

function itemId(item: PreviewItem): string {
  return item.id;
}

function isVideo(item: PreviewItem): boolean {
  if ('kind' in item && item.kind === 'video') return true;
  return (item.mimeType || '').startsWith('video/');
}

function isImage(item: PreviewItem): boolean {
  const mime = item.mimeType || '';
  return mime.startsWith('image/') || ('kind' in item && item.kind === 'photo');
}

export interface MediaPreviewProps {
  items: PreviewItem[];
  /** Resolves a server-side file into a temporary blob URL. */
  resolveUrl?: (item: PreviewItem) => Promise<string>;
  onRemove?: (item: PreviewItem) => void;
  onRetry?: (item: PreviewItem) => void;
  size?: number;
}

export default function MediaPreview({ items, resolveUrl, onRemove, onRetry, size = 84 }: MediaPreviewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const [resolutionError, setResolutionError] = useState<Record<string, string>>({});

  const list = items || [];

  // Resolve anything that only has a server reference.
  useEffect(() => {
    if (!resolveUrl) return;
    let cancelled = false;

    (async () => {
      for (const item of list) {
        const id = itemId(item);
        const localUrl = (item as MediaAttachment).url;
        const hasUrl = Boolean(localUrl);
        const isBlobUrl = typeof localUrl === 'string' && localUrl.startsWith('blob:');
        if (hasUrl && isBlobUrl) continue;
        // Authenticated API files cannot be loaded by a plain <img> because
        // access tokens live in localStorage. Resolve them through Axios.
        if (hasUrl && !String(localUrl).startsWith('/api/')) continue;
        if (resolved[id] || resolutionError[id]) continue;
        try {
          const url = await resolveUrl(item);
          if (!cancelled && url) setResolved((prev) => ({ ...prev, [id]: url }));
        } catch {
          if (!cancelled) setResolutionError((prev) => ({ ...prev, [id]: 'Preview unavailable' }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map(itemId).join('|'), resolved, resolutionError]);

  // Release blob URLs created for server files.
  useEffect(
    () => () => {
      Object.values(resolved).forEach((url) => {
        if (url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            /* ignore */
          }
        }
      });
    },
    [resolved]
  );

  if (!list.length) return null;

  const active = openIndex !== null ? list[openIndex] : null;
  const activeStoredUrl = active ? (active as MediaAttachment).url : undefined;
  const activeNeedsAuth = Boolean(resolveUrl && activeStoredUrl?.startsWith('/api/'));
  const activeUrl = active
    ? resolved[itemId(active)] || (activeNeedsAuth ? undefined : activeStoredUrl)
    : undefined;

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {list.map((item, index) => {
          const id = itemId(item);
          const storedUrl = (item as MediaAttachment).url;
          const needsAuth = Boolean(resolveUrl && storedUrl?.startsWith('/api/'));
          const url = resolved[id] || (needsAuth ? undefined : storedUrl);
          const uploading = (item as MediaAttachment).uploadState === 'uploading';
          const failed = (item as MediaAttachment).uploadState === 'error';
          const progress = (item as MediaAttachment).progress ?? 0;
          const video = isVideo(item);

          return (
            <Box key={id} sx={{ position: 'relative' }}>
              <Tooltip title={`${item.name || 'File'} · ${formatFileSize(item.size || 0)}${failed ? ' · upload failed' : ''}`}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => (failed && onRetry ? onRetry(item) : setOpenIndex(index))}
                  aria-label={`Preview ${item.name || 'attachment'}`}
                  sx={{
                    width: size,
                    height: size,
                    p: 0,
                    border: '1px solid',
                    borderColor: failed ? 'error.main' : 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'background.subtle',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    '&:hover': { borderColor: 'primary.main' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  {url && isImage(item) ? (
                    <Box component="img" src={url} alt={item.name || 'attachment'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : url && video ? (
                    <>
                      <Box component="video" src={url} muted sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <VideocamOutlinedIcon sx={{ position: 'absolute', color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }} />
                    </>
                  ) : item.mimeType === 'application/pdf' ? (
                    <InsertDriveFileOutlinedIcon color="action" />
                  ) : isVideo(item) ? (
                    <VideocamOutlinedIcon color="action" />
                  ) : (
                    <ImageOutlinedIcon color="action" />
                  )}

                  {uploading && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(15,23,42,0.35)' }}>
                      <CircularProgress size={20} sx={{ color: '#fff' }} />
                    </Box>
                  )}
                  {failed && (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(239,68,68,0.25)', color: 'error.dark' }}>
                      <RefreshIcon fontSize="small" />
                    </Box>
                  )}
                </Box>
              </Tooltip>

              {uploading && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 }}
                  aria-label={`Uploading ${item.name}`}
                />
              )}

              {onRemove && !uploading && (
                <IconButton
                  size="small"
                  onClick={() => onRemove(item)}
                  aria-label={`Remove ${item.name || 'attachment'}`}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    width: 22,
                    height: 22,
                    '&:hover': { bgcolor: 'error.main', color: '#fff' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>

      <Dialog open={openIndex !== null} onClose={() => setOpenIndex(null)} maxWidth="md" fullWidth>
        <DialogContent sx={{ position: 'relative', bgcolor: '#0f172a', p: { xs: 1, sm: 2 } }}>
          <IconButton
            onClick={() => setOpenIndex(null)}
            aria-label="Close preview"
            sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' }}
          >
            <CloseIcon />
          </IconButton>
          {active && activeUrl ? (
            isVideo(active) ? (
              <Box component="video" src={activeUrl} controls autoPlay sx={{ width: '100%', maxHeight: '70vh', borderRadius: 2 }} />
            ) : isImage(active) ? (
              <Box component="img" src={activeUrl} alt={active.name || 'attachment'} sx={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 2 }} />
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', color: '#fff' }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 48 }} />
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {active.name}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
                  {formatFileSize(active.size || 0)} · {active.mimeType || 'document'}
                </Typography>
                <Typography
                  component="a"
                  href={activeUrl}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: '#93c5fd', textDecoration: 'underline' }}
                >
                  Open document in a new tab
                </Typography>
              </Box>
            )
          ) : (
            <Box sx={{ p: 6, textAlign: 'center', color: '#fff' }}>
              <CircularProgress size={22} sx={{ color: '#fff' }} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Loading attachment…
              </Typography>
            </Box>
          )}
          {active && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)' }}>
                {active.name} · {formatFileSize(active.size || 0)}
              </Typography>
              {onRemove && (
                <IconButton
                  size="small"
                  onClick={() => {
                    onRemove(active);
                    setOpenIndex(null);
                  }}
                  aria-label="Delete attachment"
                  sx={{ color: '#fca5a5' }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
