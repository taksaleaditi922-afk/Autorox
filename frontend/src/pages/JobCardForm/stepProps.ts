import type { JobCardFormState } from '../../utils/jobCard';
import type { AdvancePayload, DeliveryResult } from '../../services/jobCard/approvalService';

export type JobCardObjectSection =
  | 'vehicle'
  | 'insurance'
  | 'customer'
  | 'intake'
  | 'approval'
  | 'orderSummary';

/**
 * Navigation, persistence and approval hooks supplied by the wizard container.
 * Optional so an individual step can still be rendered in isolation (tests,
 * storybook) without wiring the whole page.
 */
export interface JobCardStepActions {
  /** Validate the current step and advance. */
  reference?: string;
  createdAt?: string;
  businessName?: string;
  goNext: () => void;
  /** Return to the previous step. */
  goBack: () => void;
  /** Persist the form — local draft, plus the server when the card exists. */
  save: () => void;
  /** Store the advance through the API. Resolves false when it could not be saved. */
  recordAdvance: (payload: AdvancePayload) => Promise<boolean>;
  /** Send the itemised list to the customer. */
  share: (payload: { channels: string[]; message?: string }) => Promise<{ link?: string; delivery?: DeliveryResult[] } | null>;
  /** Record an approval outcome at the desk (approved / changes requested). */
  setApproval: (patch: Record<string, unknown>) => Promise<boolean>;
  /** Mark the approval as skipped and continue to the next step. */
  skip: () => Promise<void>;
  /** Who is editing — stamped on every line item. */
  currentUser: string;
  /** True once the job card exists on the server. */
  persisted: boolean;
  /** True while a save / share request is in flight. */
  saving: boolean;
}

export interface JobCardStepProps {
  form: JobCardFormState;
  /** Field errors for this step, keyed by dot-path (empty until the step is attempted). */
  errors: Record<string, string>;
  /** Merge a top level patch into the form. */
  set: (patch: Partial<JobCardFormState>) => void;
  /** Merge a patch into one of the nested object sections. */
  setSection: (section: JobCardObjectSection, patch: Record<string, unknown>) => void;
  /** Wizard actions; absent when the step is rendered standalone. */
  actions?: JobCardStepActions;
}
