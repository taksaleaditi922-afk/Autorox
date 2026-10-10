import { DragEvent, useRef, useState } from 'react';
import { Avatar, Box, Button, Chip, Stack, Typography } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CloseIcon from '@mui/icons-material/Close';
import * as mediaService from '../../services/estimate/mediaService';

export type UploadedProof = { id: string; name: string; size: number; type: string; url?: string };

export default function PaymentProofUpload({ files, onChange, multiple = true, disabled, prompt = 'Browse and upload screenshot or receipt' }: {
  files: UploadedProof[]; onChange: (files: UploadedProof[]) => void; multiple?: boolean; disabled?: boolean; prompt?: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (incoming: FileList | File[]) => {
    const accepted: UploadedProof[] = [];
    let nextError = '';
    Array.from(incoming).slice(0, multiple ? undefined : 1).forEach((file) => {
      const result = mediaService.validateFile(file, 'document');
      if (!result.ok) { nextError ||= result.error || 'Unsupported file'; return; }
      accepted.push({ id: `${file.name}-${file.lastModified}-${Math.random()}`, name: file.name, size: file.size, type: file.type, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined });
    });
    onChange(multiple ? [...files, ...accepted] : accepted);
    setError(nextError);
    if (input.current) input.current.value = '';
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    if (!disabled) addFiles(event.dataTransfer.files);
  };

  const remove = (id: string) => onChange(files.filter((proof) => {
    if (proof.id === id) mediaService.revokeObjectUrl(proof.url);
    return proof.id !== id;
  }));

  return <Box>
    <input ref={input} type="file" accept="image/*,.pdf,application/pdf" multiple={multiple} hidden onChange={(event) => event.target.files && addFiles(event.target.files)} />
    <Box role="button" tabIndex={disabled ? -1 : 0} aria-label="Upload payment proof" onClick={() => !disabled && input.current?.click()}
      onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); input.current?.click(); } }}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}
      sx={{ border: '1px dashed', borderColor: dragging ? 'primary.main' : 'divider', borderRadius: 2, p: 2.5, textAlign: 'center', cursor: disabled ? 'default' : 'pointer' }}>
      <CloudUploadOutlinedIcon color="action" />
      <Typography variant="body2" color="text.secondary" mb={1}>{prompt}</Typography>
      <Button component="span" size="small" variant="outlined" disabled={disabled}>+ Browse File</Button>
    </Box>
    {error && <Typography variant="caption" color="error" display="block" mt={0.75}>{error}</Typography>}
    {!!files.length && <Stack direction="row" flexWrap="wrap" useFlexGap gap={1} mt={1.5}>{files.map((proof) =>
      <Chip key={proof.id} avatar={proof.url ? <Avatar src={proof.url} alt="" /> : undefined} label={`${proof.name} · ${mediaService.formatFileSize(proof.size)}`} onDelete={disabled ? undefined : () => remove(proof.id)} deleteIcon={<CloseIcon />} variant="outlined" />
    )}</Stack>}
  </Box>;
}
