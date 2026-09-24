import ReviewFooter from '../../components/jobCard/ReviewFooter';
import { Avatar, TextField } from '@mui/material';
import api from '../../services/api';
// ---------------------------------------------------------------------------
// New / Edit Job Card — the six-step intake wizard.
//
// Owns: the page header, step progress, per-step validation gating, local draft
// autosave (so a refresh never loses work), the unsaved-changes guard and the
// sticky Back / Save navigation. The six steps live in ./steps.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { createJobCard, fetchJobCard, updateJobCard } from '../../redux/jobSlice';
import { showToast } from '../../redux/uiSlice';
import type { RootState, AppDispatch } from '../../store/store';
import * as approvalApi from '../../services/jobCard/approvalService';
import type { AdvancePayload, DeliveryResult } from '../../services/jobCard/approvalService';
import Loader from '../../components/Loader';
import JobCardStepper from './JobCardStepper';
import VehicleClientStep from './steps/VehicleClientStep';
import InspectionReportStep from './steps/InspectionReportStep';
import ServicesPartsStep from './steps/ServicesPartsStep';
import ApprovalStep from './steps/ApprovalStep';
import OrderSummaryStep from './steps/OrderSummaryStep';
import ReminderStep from './steps/ReminderStep';
import type { JobCardStepActions, JobCardStepProps } from './stepProps';
import {
  JOB_CARD_STEPS,
  buildJobCardPayload,
  computeOrderSummary,
  createEmptyJobCardForm,
  createLineItem,
  mapJobCardToForm,
  type JobCardFormState,
} from '../../utils/jobCard';
import { stepValidator, validateJobCardForm } from '../../utils/jobCardValidation';
import { formatCurrency } from '../../utils/format';

const DRAFT_KEY = 'autorox:jobcard:draft:new';

const STEP_COMPONENTS: React.ComponentType<JobCardStepProps>[] = [
  VehicleClientStep,
  InspectionReportStep,
  ServicesPartsStep,
  ApprovalStep,
  OrderSummaryStep,
  ReminderStep,
];

/**
 * A draft written by an older build may be missing newer sections, so it is
 * layered over a fresh form rather than trusted as-is.
 */
function mergeWithDefaults(stored: Partial<JobCardFormState>): JobCardFormState {
  const base = createEmptyJobCardForm();
  return {
    ...base,
    ...stored,
    vehicle: { ...base.vehicle, ...stored.vehicle },
    insurance: { ...base.insurance, ...stored.insurance },
    customer: { ...base.customer, ...stored.customer },
    intake: { ...base.intake, ...stored.intake },
    approval: { ...base.approval, ...stored.approval },
    advance: { ...base.advance, ...stored.advance },
    advances: stored.advances || base.advances,
    supervisor: stored.supervisor || base.supervisor,
    estimatedDelivery: typeof stored.estimatedDelivery === 'string'
      ? { ...base.estimatedDelivery, date: stored.estimatedDelivery }
      : { ...base.estimatedDelivery, ...stored.estimatedDelivery },
    orderSummary: { ...base.orderSummary, ...stored.orderSummary },
    inspectionReport: stored.inspectionReport?.length ? stored.inspectionReport : base.inspectionReport,
    reminders: stored.reminders || [],
    lineItems: (stored.lineItems || []).map((line) => createLineItem(line)),
  };
}

function readDraft(): { form: JobCardFormState; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.form) return null;
    return { form: mergeWithDefaults(parsed.form), savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

function writeDraft(form: JobCardFormState): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, savedAt: new Date().toISOString() }));
  } catch {
    // Storage can be full or blocked; autosave is best-effort.
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function draftHasContent(form?: JobCardFormState | null): boolean {
  if (!form) return false;
  return Boolean(form.vehicle?.registrationNumber || form.customer?.name || (form.lineItems || []).length);
}

export default function JobCardForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { current } = useSelector((state: RootState) => state.jobCards);
  const user = useSelector((state: RootState) => state.auth.user);
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<JobCardFormState>(() => createEmptyJobCardForm());
  // The server side id. Starts as the edited job card's id; a draft created so
  // the customer approval link can be shared is stored here too.
  const [persistedId, setPersistedId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [attemptedSteps, setAttemptedSteps] = useState<number[]>([]);
  const [recoverable, setRecoverable] = useState<ReturnType<typeof readDraft>>(null);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const currentUser = (user as any)?.name || (user as any)?.email || 'You';

  // ------------------------------------------------------------- bootstrapping
  useEffect(() => {
    setPersistedId(id ? String(id) : null);
    if (isEdit) {
      void dispatch(fetchJobCard(id as string));
      return () => undefined;
    }
    setForm(createEmptyJobCardForm());
    const stored = readDraft();
    setRecoverable(draftHasContent(stored?.form) ? stored : null);
    return () => undefined;
  }, [id, isEdit, dispatch]);

  useEffect(() => {
    if (isEdit && current && current._id === id) {
      setForm(mapJobCardToForm(current));
      setMaxStepReached(JOB_CARD_STEPS.length - 1);
    }
  }, [isEdit, current, id]);

  // Merge only approval data, preserving unsaved service and customer edits.
  useEffect(() => {
    if (!persistedId || submitting) return;
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await api.get(`/jobcards/${persistedId}`);
        if (active) {
          const next = mapJobCardToForm(response.data.data).approval;
          setForm(previous => JSON.stringify(previous.approval.history) === JSON.stringify(next.history) && previous.approval.status === next.status && previous.approval.respondedAt === next.respondedAt ? previous : { ...previous, approval: next });
        }
      } catch { /* Retain last known data; the next refresh retries. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [persistedId, submitting]);

  // Deep link / dashboard shortcuts, e.g. /jobcards/:id/edit?step=1
  useEffect(() => {
    const raw = searchParams.get('step');
    if (raw === null) return;
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < JOB_CARD_STEPS.length) {
      setCurrentStep(parsed);
      setMaxStepReached((m) => Math.max(m, parsed));
    }
    // Read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave new drafts to this browser. Edited job cards are persisted on save.
  useEffect(() => {
    if (isEdit) return () => undefined;
    const timer = setTimeout(() => writeDraft(form), 700);
    return () => clearTimeout(timer);
  }, [form, isEdit]);

  // --------------------------------------------------------------- validation
  const stepResults = useMemo(() => JOB_CARD_STEPS.map((_step, index) => stepValidator(index)(form)), [form]);

  const stepValidity = useMemo(
    () => Object.fromEntries(stepResults.map((result, index) => [index, result.valid])) as Record<number, boolean>,
    [stepResults]
  );

  const stepIssueCount = useMemo(() => {
    return Object.fromEntries(
      stepResults.map((result, index) => {
        const engaged = attemptedSteps.includes(index) || completedSteps.includes(index);
        const issues = result.summary.length || Object.keys(result.errors).length;
        return [index, engaged ? issues : 0];
      })
    ) as Record<number, number>;
  }, [stepResults, attemptedSteps, completedSteps]);

  const totals = useMemo(() => computeOrderSummary(form), [form]);

  // -------------------------------------------------------------- form updates
  const scrollTop = () => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const set = (patch: Partial<JobCardFormState>) => {
    setDirty(true);
    setForm((previous) => ({ ...previous, ...patch }));
  };

  const setSection: JobCardStepProps['setSection'] = (section, patch) => {
    setDirty(true);
    setForm((previous) => ({ ...previous, [section]: { ...(previous[section] as object), ...patch } }));
  };

  // --------------------------------------------------------------- navigation
  const handleContinue = async () => {
    const result = stepResults[currentStep];
    if (!result.valid) {
      setAttemptedSteps((previous) => (previous.includes(currentStep) ? previous : [...previous, currentStep]));
      dispatch(
        showToast({
          severity: 'error',
          message: `Please fix ${result.summary.length || Object.keys(result.errors).length} item(s) in ${
            JOB_CARD_STEPS[currentStep].label
          } before continuing`,
        })
      );
      scrollTop();
      return;
    }
    if ((currentStep === 3 || currentStep === 4) && persistedId) {
      setSubmitting(true);
      const action = await dispatch(updateJobCard({ id: persistedId, payload: buildJobCardPayload(form) }));
      setSubmitting(false);
      if (!action.type.endsWith('/fulfilled')) {
        dispatch(showToast({ severity: 'error', message: 'Could not save the order summary' }));
        return;
      }
    }
    writeDraft(form);
    setDirty(false);
    setCompletedSteps((previous) => (previous.includes(currentStep) ? previous : [...previous, currentStep]));
    setMaxStepReached((previous) => Math.max(previous, currentStep + 1));
    setCurrentStep((previous) => Math.min(previous + 1, JOB_CARD_STEPS.length - 1));
    scrollTop();
  };

  const handleBack = () => {
    if (currentStep === 0) {
      if (dirty && !isEdit) {
        setConfirmLeave(true);
        return;
      }
      navigate('/jobcards');
      return;
    }
    if (currentStep === 4 && dirty && !window.confirm('Go back with unsaved changes? Your changes will remain in this form.')) return;
    setCurrentStep((previous) => Math.max(previous - 1, 0));
    scrollTop();
  };

  const handleSaveDraft = async () => {
    writeDraft(form);
    if (!persistedId) {
      setDirty(false);
      dispatch(showToast({ severity: 'success', message: 'Draft saved in this browser' }));
      return;
    }
    const action: any = await dispatch(updateJobCard({ id: persistedId, payload: buildJobCardPayload(form) }));
    if (action.type.endsWith('/fulfilled')) {
      setDirty(false);
      dispatch(showToast({ severity: 'success', message: 'Job card saved' }));
    } else {
      dispatch(showToast({ severity: 'error', message: action.payload || 'Could not save to the server' }));
    }
  };

  // ------------------------------------------- service list (steps 3 and 4)

  /** Create the job card as a draft when it does not exist yet. */
  const ensurePersisted = async (): Promise<string | null> => {
    if (persistedId) return persistedId;
    const action: any = await dispatch(createJobCard({ ...buildJobCardPayload(form), isDraft: true }));
    if (action.type.endsWith('/fulfilled') && action.payload?._id) {
      setPersistedId(action.payload._id);
      dispatch(showToast({ severity: 'info', message: 'Saved as a draft so the approval link can be shared' }));
      return action.payload._id;
    }
    dispatch(showToast({ severity: 'error', message: action.payload || 'Could not save the job card' }));
    return null;
  };

  const recordAdvance = async (payload: AdvancePayload): Promise<boolean> => {
    // Until the job card exists the advance travels with the form (and is sent
    // on the first save), so no server round trip is needed.
    if (!persistedId) return false;
    try {
      await approvalApi.recordAdvance(persistedId, payload);
      return true;
    } catch (err: any) {
      dispatch(
        showToast({ severity: 'error', message: err?.response?.data?.error || 'Could not record the advance' })
      );
      return false;
    }
  };

  const share = async ({
    channels,
    message,
  }: {
    channels: string[];
    message?: string;
  }): Promise<{ link?: string; delivery?: DeliveryResult[] } | null> => {
    const targetId = await ensurePersisted();
    if (!targetId) return null;
    try {
      // Persist the currently displayed list and registered phone before sending.
      const saved: any = await dispatch(updateJobCard({ id: targetId, payload: buildJobCardPayload(form) }));
      if (!saved.type.endsWith('/fulfilled')) throw new Error(saved.payload || 'Could not save the service list');
      const result = await approvalApi.shareApproval(targetId, { channels, message });
      setForm((previous) => ({
        ...previous,
        approval: {
          ...previous.approval,
          status: result.status,
          sharedAt: result.sharedAt,
          channels,
          token: result.token,
        },
      }));
      const delivered = result.delivery?.some((entry) => entry.delivered);
      dispatch(
        showToast({
          severity: 'success',
          message: delivered ? 'Service list sent to the customer' : 'Approval link generated',
        })
      );
      return { link: result.link, delivery: result.delivery };
    } catch (err: any) {
      dispatch(
        showToast({ severity: 'error', message: err?.response?.data?.error || err?.message || 'Could not share the service list' })
      );
      return null;
    }
  };

  const setApproval = async (patch: Record<string, unknown>): Promise<boolean> => {
    if (!persistedId) return false;
    try {
      await approvalApi.updateApproval(persistedId, patch);
      return true;
    } catch (err: any) {
      dispatch(showToast({ severity: 'error', message: err?.response?.data?.error || 'Could not update the approval' }));
      return false;
    }
  };

  const skipApproval = async () => {
    if (persistedId && !(await setApproval({ status: 'skipped' }))) return;
    setForm(previous => ({ ...previous, approval: { ...previous.approval, status: 'skipped' } }));
    handleContinue();
  };

  const handleSubmit = async () => {
    const result = validateJobCardForm(form);
    if (!result.valid) {
      const firstInvalid = stepResults.findIndex((step) => !step.valid);
      if (firstInvalid >= 0) {
        setCurrentStep(firstInvalid);
        setMaxStepReached((m) => Math.max(m, firstInvalid));
        setAttemptedSteps((previous) => (previous.includes(firstInvalid) ? previous : [...previous, firstInvalid]));
      }
      dispatch(showToast({ severity: 'error', message: 'Please fix the highlighted items before saving' }));
      scrollTop();
      return;
    }

    setSubmitting(true);
    // A record may already exist even in "new" mode: sharing the service list
    // creates the job card as a draft so the approval link has something to point
    // at. Submit then updates that draft instead of creating a second card.
    const targetId = persistedId || (isEdit ? String(id) : null);
    const payload = targetId ? { ...buildJobCardPayload(form), isDraft: false } : buildJobCardPayload(form);
    const action: any = targetId
      ? await dispatch(updateJobCard({ id: targetId, payload }))
      : await dispatch(createJobCard(payload));
    setSubmitting(false);

    if (action.type.endsWith('/fulfilled')) {
      clearDraft();
      dispatch(showToast({ severity: 'success', message: isEdit ? 'Job card updated' : 'Job card created' }));
      const newId = action.payload?._id || targetId || id;
      navigate(newId ? `/jobcards/${newId}` : '/jobcards');
    } else {
      dispatch(showToast({ severity: 'error', message: action.payload || 'Could not save the job card' }));
    }
  };

  const handleRecover = () => {
    if (recoverable?.form) {
      setForm(recoverable.form);
      setDirty(true);
      dispatch(showToast({ severity: 'success', message: 'Unsaved draft restored' }));
    }
    setRecoverable(null);
  };

  const handleDiscard = () => {
    clearDraft();
    setRecoverable(null);
    setAttemptedSteps([]);
    setForm(createEmptyJobCardForm());
    dispatch(showToast({ severity: 'info', message: 'Local draft discarded' }));
  };

  if (isEdit && !form.vehicle.registrationNumber && !current) {
    return <Loader label="Loading job card..." />;
  }

  const stepActions: JobCardStepActions = {
    reference: current?._id === persistedId ? current.jobCardNumber : persistedId || undefined,
    createdAt: current?._id === persistedId ? current.createdAt : undefined,
    businessName: import.meta.env.VITE_BUSINESS_NAME || 'Your workshop',
    goNext: handleContinue,
    goBack: handleBack,
    save: handleSaveDraft,
    recordAdvance,
    share,
    setApproval,
    skip: skipApproval,
    currentUser,
    persisted: Boolean(persistedId),
    saving: submitting,
  };

  const StepComponent = STEP_COMPONENTS[currentStep];
  const engaged = attemptedSteps.includes(currentStep) || completedSteps.includes(currentStep);
  const stepErrors = engaged ? stepResults[currentStep].errors : {};
  const isReview = currentStep === 3 || currentStep === 4;
  const isLastStep = currentStep === JOB_CARD_STEPS.length - 1;

  return (
    <Box>
      {/* ------------------------------- header ------------------------------- */}
      {isReview ? <Paper sx={{ mb: 3.5, px: { xs: 2, md: 4 }, py: 1.5, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}><Typography variant="h5" fontWeight={800}>Job Card</Typography><Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">{currentStep === 4 && <><Typography fontWeight={600}>Estimated Delivery</Typography><TextField type="date" size="small" value={form.estimatedDelivery.date} inputProps={{ 'aria-label': 'Estimated delivery date' }} onChange={e => set({ estimatedDelivery: { ...form.estimatedDelivery, date: e.target.value } })} /><TextField type="time" size="small" value={form.estimatedDelivery.time} inputProps={{ 'aria-label': 'Estimated delivery time' }} onChange={e => set({ estimatedDelivery: { ...form.estimatedDelivery, time: e.target.value } })} /></>}<Avatar>{currentUser[0]}</Avatar></Stack></Paper> : <>
      <Box sx={{ mb: 2.5 }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/jobcards')} sx={{ mb: 0.5, ml: -0.5 }}>
          Back to Job Cards
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AssignmentTurnedInIcon color="primary" />
              <Typography variant="h5" fontWeight={800}>
                {isEdit ? 'Edit Job Card' : 'New Job Card'}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {isEdit
                ? 'Update the booking and save your changes at any step'
                : 'Progress is saved in this browser automatically as you type'}
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch checked={form.updateToCustomer} onChange={(e) => set({ updateToCustomer: e.target.checked })} />
            }
            label={<Typography variant="body2">Update to Customer</Typography>}
          />
        </Box>
      </Box>

      </>}
      {recoverable && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={handleRecover}>
                Recover
              </Button>
              <Button size="small" onClick={handleDiscard}>
                Discard
              </Button>
            </Stack>
          }
        >
          An unsaved job card draft from{' '}
          {recoverable.savedAt ? new Date(recoverable.savedAt).toLocaleString('en-IN') : 'earlier'} was found in this browser.
        </Alert>
      )}

      {/* ------------------------------ stepper ------------------------------- */}
      <Paper elevation={isReview ? 0 : undefined} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2.5, borderRadius: 3, ...(isReview ? { bgcolor: 'transparent' } : {}) }}>
        <JobCardStepper
          currentStep={currentStep}
          maxStepReached={maxStepReached}
          completedSteps={completedSteps}
          stepValidity={stepValidity}
          stepIssueCount={stepIssueCount}
          onStepSelect={(next) => {
            setCurrentStep(next);
            scrollTop();
          }}
        />
        {!isReview && <><Divider sx={{ mb: 1.5 }} />
        <Typography variant="body2" color="text.secondary">
          <strong>{JOB_CARD_STEPS[currentStep].label}</strong> — step {currentStep + 1} of {JOB_CARD_STEPS.length}
        </Typography>
        </>}
      </Paper>

      {/* ---------------------------- step content --------------------------- */}
      <Box key={currentStep} sx={{ animation: 'stepEnter 220ms ease-out', '@keyframes stepEnter': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } }, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}><StepComponent form={form} errors={stepErrors} set={set} setSection={setSection} actions={stepActions} /></Box>

      {/* ---------------------------- sticky footer --------------------------- */}
      {isReview ? <ReviewFooter form={form} set={set} summary={currentStep === 4} busy={submitting} back={handleBack} save={handleSaveDraft} next={handleContinue} user={currentUser} reference={stepActions.reference} createdAt={stepActions.createdAt} /> : <>
      <Paper
        elevation={6}
        sx={{ position: 'sticky', bottom: 0, mt: 2.5, mx: -1, px: { xs: 1.5, sm: 2 }, py: 1.5, borderRadius: 3, zIndex: 5 }}
      >
        {(currentStep === 3 || currentStep === 4) && <Stack direction="row" flexWrap="wrap" gap={{ xs: 1, sm: 3 }} mb={1} aria-label="Order totals"><Typography variant="body2">Subtotal {formatCurrency(totals.subtotal)}</Typography><Typography variant="body2">Tax {formatCurrency(totals.tax)}</Typography><Typography variant="body2">Discount {formatCurrency(totals.lineDiscount + totals.discount)}</Typography><Typography fontWeight={800}>Grand Total {formatCurrency(totals.grandTotal)}</Typography></Stack>}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack} size={isMobile ? 'small' : 'medium'}>
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>

          {!isMobile && (
            <Typography variant="caption" color="text.secondary">
              {form.lineItems.length} item{form.lineItems.length === 1 ? '' : 's'} · Order total {formatCurrency(totals.total)}
            </Typography>
          )}

          <Stack direction="row" spacing={1}>
            {(!isEdit || currentStep === 4) && (
              <Button
                variant="outlined"
                startIcon={<SaveOutlinedIcon />}
                onClick={handleSaveDraft}
                size={isMobile ? 'small' : 'medium'}
              >
                {currentStep === 4 ? 'Save' : 'Save Draft'}
              </Button>
            )}
            {isLastStep ? (
              <Button
                variant="contained"
                color="primary"
                size={isMobile ? 'small' : 'large'}
                onClick={handleSubmit}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} /> : undefined}
              >
                {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job Card'}
              </Button>
            ) : (
              <Button
                variant="contained"
                size={isMobile ? 'small' : 'large'}
                endIcon={<ArrowForwardIcon />}
                onClick={handleContinue}
                disabled={submitting}
              >
                Save &amp; Next
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>

      </>}
      {/* -------------------------- unsaved changes guard --------------------- */}
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Your draft is stored in this browser. Leave the new job card anyway?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmLeave(false)}>Keep editing</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setConfirmLeave(false);
              navigate('/jobcards');
            }}
          >
            Leave
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
