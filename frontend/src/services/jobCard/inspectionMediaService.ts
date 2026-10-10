import api from '../api';
import * as mediaService from '../estimate/mediaService';
import type { MediaAttachment } from '../estimate/types';
import { newId } from '../../utils/id';

function apiPath(url: string): string {
  return url.startsWith('/api/') ? url.slice(4) : url;
}

function documentId(item: MediaAttachment): string | undefined {
  if (item.serverId) return item.serverId;
  return item.url?.match(/\/documents\/([^/]+)\/file(?:\?|$)/)?.[1];
}

function jobCardId(item: MediaAttachment): string | undefined {
  return item.url?.match(/\/jobcards\/([^/]+)\/documents\//)?.[1];
}

export async function uploadInspectionPhoto(
  targetJobCardId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<MediaAttachment> {
  const validation = mediaService.validateFile(file, 'photo');
  if (!validation.ok) throw new Error(validation.error);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'Image');

  const response = await api.post(`/jobcards/${targetJobCardId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (event.total && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
  const document = response.data?.data;
  const serverId = document?._id || document?.id;
  if (!serverId) throw new Error('The photo was uploaded but no file reference was returned.');

  return {
    id: newId('inspection-photo'),
    serverId,
    name: document.name || file.name,
    kind: 'photo',
    mimeType: document.mimeType || file.type,
    size: document.size || file.size,
    url: document.downloadUrl || `/api/jobcards/${targetJobCardId}/documents/${serverId}/file`,
    uploadState: 'done',
    progress: 100,
    uploadedAt: document.uploadedAt || new Date().toISOString(),
    localOnly: false,
  };
}

export async function fetchInspectionPhoto(item: MediaAttachment): Promise<string> {
  if (!item.url) throw new Error('Preview unavailable');
  const response = await api.get(apiPath(item.url), { responseType: 'blob' });
  return URL.createObjectURL(response.data as Blob);
}

export async function removeInspectionPhoto(item: MediaAttachment): Promise<void> {
  const targetJobCardId = jobCardId(item);
  const targetDocumentId = documentId(item);
  if (!targetJobCardId || !targetDocumentId) return;
  await api.delete(`/jobcards/${targetJobCardId}/documents/${targetDocumentId}`);
}
