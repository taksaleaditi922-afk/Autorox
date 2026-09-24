// ---------------------------------------------------------------------------
// Notification / sharing abstraction.
//
// Each channel is a thin adapter so a real provider (WhatsApp Business API,
// SMS gateway, transactional email) can replace the deep-link behaviour without
// touching the UI.
// ---------------------------------------------------------------------------

import api from '../api';
import { formatMoney } from '../../utils/estimateMath';
import type { EstimateBusinessConfig, EstimateState } from './types';

export type ShareChannel = 'whatsapp' | 'sms' | 'email' | 'copy-link' | 'print' | 'download' | 'server-pdf';

export interface ShareResult {
  channel: ShareChannel;
  ok: boolean;
  message: string;
}

const SALUTATION = (state: EstimateState) => state.customer?.name?.split(' ')[0] || 'Customer';

/** Message body used by the link-based channels. */
export function buildShareMessage(state: EstimateState, config: EstimateBusinessConfig): string {
  const vehicle = [state.vehicle.brand, state.vehicle.model].filter(Boolean).join(' ');
  const number = state.metadata?.estimateNumber || 'Draft estimate';
  return [
    `Hello ${SALUTATION(state)},`,
    ``,
    `Please find your service estimate from ${config.company.name}.`,
    `Estimate No: ${number}`,
    vehicle ? `Vehicle: ${vehicle} (${state.vehicle.registrationNumber})` : '',
    `Amount: ${formatMoney(state.totals.grandTotal, config.currency)}`,
    `Valid until: ${state.metadata?.validUntil ? new Date(state.metadata.validUntil).toLocaleDateString('en-IN') : '—'}`,
    ``,
    `Reply to this message to approve or discuss the estimate.`,
    `${config.company.name} · ${config.company.phone}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

/** Public shareable link for the estimate (server rendered page). */
export function estimateLink(estimateId: string | null): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!estimateId) return `${origin}/estimates`;
  return `${origin}/estimates/${estimateId}`;
}

async function openExternal(url: string): Promise<void> {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) throw new Error('Your browser blocked the new tab. Allow pop-ups and try again.');
}

/**
 * Dispatch a share action.
 * `send` (when provided) is the server-side provider call for channels that
 * support delivery receipts — it is attempted first and the deep-link is the
 * fallback, so the feature works before the provider is wired up.
 */
export async function share(
  channel: ShareChannel,
  state: EstimateState,
  config: EstimateBusinessConfig,
  options: { estimateId?: string | null; pdfUrl?: string } = {}
): Promise<ShareResult> {
  const message = buildShareMessage(state, config);
  const link = estimateLink(options.estimateId ?? state.draftId);
  const phone = normalizePhone(state.customer.phone);

  try {
    switch (channel) {
      case 'whatsapp': {
        if (!phone) throw new Error('Customer phone number is missing');
        await openExternal(`https://wa.me/${phone}?text=${encodeURIComponent(`${message}\n\n${link}`)}`);
        return { channel, ok: true, message: 'WhatsApp opened with the estimate message' };
      }
      case 'sms': {
        if (!phone) throw new Error('Customer phone number is missing');
        await openExternal(`sms:+${phone}?body=${encodeURIComponent(`${message} ${link}`)}`);
        return { channel, ok: true, message: 'SMS composer opened' };
      }
      case 'email': {
        if (!state.customer.email) throw new Error('Customer email address is missing');
        const subject = `Service estimate ${state.metadata?.estimateNumber || ''}`.trim();
        await openExternal(
          `mailto:${encodeURIComponent(state.customer.email)}?subject=${encodeURIComponent(
            subject
          )}&body=${encodeURIComponent(`${message}\n\n${link}`)}`
        );
        return { channel, ok: true, message: 'Email composer opened' };
      }
      case 'copy-link': {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(link);
        } else {
          const input = document.createElement('textarea');
          input.value = link;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
        }
        return { channel, ok: true, message: 'Estimate link copied to clipboard' };
      }
      case 'server-pdf':
      case 'download': {
        const url = options.pdfUrl || (options.estimateId ? `/api/estimates/${options.estimateId}/pdf` : '');
        if (!url) throw new Error('Generate the estimate first to download the PDF');
        if (channel === 'server-pdf') await openExternal(url);
        return { channel, ok: true, message: channel === 'server-pdf' ? 'PDF opened in a new tab' : 'PDF ready' };
      }
      case 'print': {
        window.print();
        return { channel, ok: true, message: 'Print dialog opened' };
      }
      default:
        return { channel, ok: false, message: 'Unsupported channel' };
    }
  } catch (err: any) {
    return { channel, ok: false, message: err?.message || 'Sharing failed' };
  }
}

/**
 * Mark the estimate as sent once a channel succeeded. Best-effort: a failure
 * here must not surface as a sharing error.
 */
export async function markAsSent(estimateId: string | null, channel: ShareChannel): Promise<void> {
  if (!estimateId) return;
  try {
    await api.post(`/estimates/${estimateId}/share`, { channel });
  } catch {
    /* the estimate is still shared; status sync can be retried later */
  }
}

export default { share, markAsSent, buildShareMessage, estimateLink };
