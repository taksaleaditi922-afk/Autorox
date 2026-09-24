// ---------------------------------------------------------------------------
// Media service — inspection photos/videos plus insurance & identity documents.
//
// Files are validated on the client for fast feedback, and the backend repeats
// every check (mime type, extension and size) before storing them. Documents
// are only ever referenced by an opaque storage key; they are never exposed on
// a public URL.
// ---------------------------------------------------------------------------

import api from '../api';
import { UPLOAD_RULES } from './config';
import { newId } from '../../utils/id';
import type { MediaAttachment, UploadedDocument } from './types';

export type UploadKind = 'photo' | 'video' | 'document';

export interface UploadContext {
  estimateId?: string | null;
  /** 'inspection' | 'insurance' | 'identity' — recorded with the file. */
  scope: string;
  /** Inspection item id / category id, when relevant. */
  itemId?: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

function rulesFor(kind: UploadKind, mimeType: string) {
  if (kind === 'document') return UPLOAD_RULES.documents;
  if (kind === 'video' || mimeType.startsWith('video/')) return UPLOAD_RULES.videos;
  return UPLOAD_RULES.photos;
}

/** Client-side file validation (size, mime type, extension). */
export function validateFile(file: File, kind: UploadKind): ValidationResult {
  if (!file) return { ok: false, error: 'No file selected' };
  const rules = rulesFor(kind, file.type || '');
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';

  const allowedExtensions = rules.accept.split(',').map((e) => e.trim().toLowerCase());
  const extensionOk = allowedExtensions.some((a) => a.startsWith('.') && a === ext);
  const mimeOk = !file.type || rules.mimeTypes.includes(file.type);

  if (!mimeOk || (allowedExtensions.some((a) => a.startsWith('.')) && !extensionOk && !mimeOk)) {
    return {
      ok: false,
      error: `Unsupported file type. Allowed: ${rules.accept}`,
    };
  }
  if (file.size > rules.maxSizeMb * 1024 * 1024) {
    return { ok: false, error: `File is too large. Maximum ${rules.maxSizeMb} MB.` };
  }
  return { ok: true };
}

function kindFor(file: File): UploadKind {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'photo';
  return 'document';
}

/** Create the optimistic attachment shown while the upload is in flight. */
export function createPendingAttachment(file: File): MediaAttachment {
  const kind: MediaAttachment['kind'] = file.type.startsWith('video/') ? 'video' : 'photo';
  return {
    id: newId('media'),
    name: file.name,
    kind,
    mimeType: file.type,
    size: file.size,
    url: URL.createObjectURL(file),
    file,
    uploadState: 'pending',
    progress: 0,
    uploadedAt: new Date().toISOString(),
    localOnly: true,
  };
}

function buildFormData(file: File, context: UploadContext): FormData {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('scope', context.scope);
  if (context.itemId) formData.append('itemId', context.itemId);
  return formData;
}

/**
 * Upload a file. Throws a descriptive Error on failure so the caller can show
 * "Upload failed. Try again." and keep the local blob for a retry.
 */
export async function uploadFile(file: File, context: UploadContext): Promise<{ id: string; url: string; storageKey?: string }> {
  if (!context.estimateId) {
    throw new Error('Save the draft before uploading files, or retry once the draft exists.');
  }
  const res = await api.post(`/estimates/${context.estimateId}/media`, buildFormData(file, context), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const doc = res.data?.data;
  if (!doc) throw new Error('Upload failed. Try again.');
  return {
    id: doc._id || doc.id || newId('media'),
    url: doc.url || '',
    storageKey: doc.storageKey || doc.filePath,
  };
}

export async function uploadMedia(
  file: File,
  context: UploadContext,
  onProgress?: (percent: number) => void
): Promise<MediaAttachment> {
  const kind = kindFor(file);
  const validation = validateFile(file, kind);
  if (!validation.ok) throw new Error(validation.error);

  const pending = createPendingAttachment(file);
  if (!context.estimateId) {
    return { ...pending, uploadState: 'error', error: 'Save the draft to attach files' };
  }

  try {
    const res = await api.post(`/estimates/${context.estimateId}/media`, buildFormData(file, context), {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    const doc = res.data?.data;
    if (!doc) throw new Error('Upload failed. Try again.');
    return {
      ...pending,
      id: doc._id || doc.id || pending.id,
      url: doc.url || pending.url,
      serverId: doc._id || doc.id,
      uploadState: 'done',
      progress: 100,
      localOnly: false,
      file: undefined,
    };
  } catch (err: any) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      'Upload failed. Try again.';
    return { ...pending, uploadState: 'error', error: message };
  }
}

/** Upload an insurance / identity document. */
export async function uploadDocument(
  file: File,
  context: UploadContext,
  onProgress?: (percent: number) => void
): Promise<UploadedDocument> {
  const validation = validateFile(file, 'document');
  if (!validation.ok) throw new Error(validation.error);

  const base: UploadedDocument = {
    id: newId('doc'),
    name: file.name,
    mimeType: file.type,
    size: file.size,
    uploadState: 'pending',
    progress: 0,
    uploadedAt: new Date().toISOString(),
  };

  if (!context.estimateId) {
    // Keep the file locally so the advisor can preview it; persistence needs a draft.
    return {
      ...base,
      url: URL.createObjectURL(file),
      uploadState: 'error',
      error: 'Save the draft to store this document securely',
    };
  }

  try {
    const res = await api.post(`/estimates/${context.estimateId}/media`, buildFormData(file, context), {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    const doc = res.data?.data;
    return {
      ...base,
      id: doc?._id || doc?.id || base.id,
      url: doc?.url || '',
      storageKey: doc?.storageKey || doc?.filePath,
      uploadState: 'done',
      progress: 100,
    };
  } catch (err: any) {
    return {
      ...base,
      uploadState: 'error',
      error: err?.response?.data?.error || 'Upload failed. Try again.',
    };
  }
}

export async function removeMedia(serverId: string | undefined, estimateId: string | null): Promise<void> {
  if (!serverId || !estimateId) return;
  try {
    await api.delete(`/estimates/${estimateId}/media/${serverId}`);
  } catch {
    // Removing the reference from the estimate is enough; a stale file on disk
    // is cleaned up by the server's retention job.
  }
}

/**
 * Fetch a stored file through the authenticated endpoint and turn it into a
 * temporary object URL for preview. Documents are never served from a public
 * path, so an <img src> cannot be used directly.
 */
export async function fetchMediaBlobUrl(estimateId: string, mediaId: string): Promise<string> {
  const res = await api.get(`/estimates/${estimateId}/media/${mediaId}`, { responseType: 'blob' });
  return URL.createObjectURL(res.data as Blob);
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Release the object URLs created for optimistic previews. */
export function revokeObjectUrl(url?: string): void {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

export default {
  validateFile,
  uploadFile,
  uploadMedia,
  uploadDocument,
  removeMedia,
  createPendingAttachment,
  fetchMediaBlobUrl,
  formatFileSize,
  revokeObjectUrl,
};
