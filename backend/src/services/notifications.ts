// ---------------------------------------------------------------------------
// Customer notifications — SMS / WhatsApp / Email.
//
// This is deliberately a thin, provider-agnostic adapter. Nothing is sent until
// a provider webhook is configured (NOTIFY_WEBHOOK_URL); until then every call
// reports `delivered: false` with the reason, so the UI can tell the advisor the
// approval link was generated but not transmitted instead of pretending a
// message went out.
//
// To wire a provider, point NOTIFY_WEBHOOK_URL at an endpoint that accepts:
//   { to, channel, subject, body, link, sender, reference }
// and answers 2xx when the message was accepted. Twilio, Gupshup, Meta Cloud
// API, MSG91 and Resend all fit behind a small relay like that.
// ---------------------------------------------------------------------------

import env from '../config/env.js';

export type NotificationChannel = 'SMS' | 'WhatsApp' | 'Email';

export interface CustomerUpdate {
  /** Phone number for SMS / WhatsApp. */
  to?: string;
  /** Email address, used when the Email channel is requested. */
  email?: string;
  customerName?: string;
  jobCardNumber?: string;
  channels: NotificationChannel[];
  subject?: string;
  body: string;
  /** Public approval link. */
  link?: string;
  /** Reference shown to the customer, e.g. the job card number. */
  reference?: string;
}

export interface DeliveryResult {
  channel: NotificationChannel;
  to: string;
  delivered: boolean;
  reason?: string;
}

/** Where to send a given channel, or a reason it cannot be delivered. */
function resolveTarget(update: CustomerUpdate, channel: NotificationChannel): string | null {
  if (channel === 'Email') return update.email?.trim() || null;
  return update.to?.trim() || null;
}

/**
 * Best-effort delivery. Never throws: a notification failure must not roll back
 * the job card change that triggered it.
 */
export async function sendCustomerUpdate(update: CustomerUpdate): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  for (const channel of update.channels) {
    const to = resolveTarget(update, channel);
    if (!to) {
      results.push({ channel, to: '', delivered: false, reason: `No ${channel === 'Email' ? 'email address' : 'phone number'} on file` });
      continue;
    }

    if (!env.notifications.webhookUrl) {
      results.push({ channel, to, delivered: false, reason: 'No notification provider configured' });
      continue;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), env.notifications.timeoutMs);
      const response = await fetch(env.notifications.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(env.notifications.webhookToken ? { Authorization: `Bearer ${env.notifications.webhookToken}` } : {}),
        },
        body: JSON.stringify({
          to,
          channel,
          subject: update.subject || `Service list for ${update.jobCardNumber || 'your vehicle'}`,
          body: update.body,
          link: update.link,
          sender: env.notifications.sender,
          reference: update.reference || update.jobCardNumber,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      results.push({
        channel,
        to,
        delivered: response.ok,
        reason: response.ok ? undefined : `Provider responded ${response.status}`,
      });
    } catch (err: any) {
      results.push({
        channel,
        to,
        delivered: false,
        reason: err?.name === 'AbortError' ? 'Provider timed out' : err?.message || 'Delivery failed',
      });
    }
  }

  return results;
}

export default { sendCustomerUpdate };
