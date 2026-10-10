// ---------------------------------------------------------------------------
// Estimate page — the 4-step quotation workflow shell.
//
// Owns: page header, step progress, per-step validation gating, debounced
// autosave (localStorage first, then the server), draft recovery, the
// unsaved-changes warning and the sticky Back / Save & Continue navigation.
// The four steps themselves live in ./steps and read the slice directly.
// ---------------------------------------------------------------------------

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch as useDispatch, useAppSelector as useSelector } from '../../store/hooks';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { showToast } from '../../redux/uiSlice';
import {
  clearErrors,
  goBackStep,
  generateEstimate,
  jumpToStep,
  loadBusinessConfig,
  loadEstimate,
  resetEstimate,
  saveDraft,
  selectEstimate,
  selectEstimateConfig,
  setCurrentStep,
  setDraftNotice,
  setStepErrors,
  hydrateEstimate,
  advanceStep,
} from '../../redux/estimateSlice';
import * as draftStorage from '../../services/estimate/draftStorage';
import { ESTIMATE_STEPS, stepValidator, validateEstimateForGeneration } from '../../utils/estimateValidation';
import { useDebounce } from '../../utils/useDebounce';
import EstimateStepper from './EstimateStepper';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ConfirmDialog, InlineAlert } from '../../components/estimate/primitives';

const VehicleClientStep = lazy(() => import('./steps/VehicleClientStep'));
const InspectionStep = lazy(() => import('./steps/InspectionStep'));
const ServicesStep = lazy(() => import('./steps/ServicesStep'));
const ReviewStep = lazy(() => import('./steps/ReviewStep'));

// Steps 1–3 read the slice themselves; ReviewStep takes explicit props.
const STEP_COMPONENTS: React.ComponentType<Record<string, never>>[] = [
  VehicleClientStep,
  InspectionStep,
  ServicesStep,
];

function StepSkeleton({ label = 'Loading step…' }: { label?: string }) {
  return (
    // role=status + aria-live so the wait is announced rather than looking
    // like a frozen page.
    <Box role="status" aria-live="polite" aria-busy="true">
      <Skeleton variant="rounded" height={150} sx={{ mb: 2.5 }} />
      <Skeleton variant="rounded" height={260} sx={{ mb: 2.5 }} />
      <Skeleton variant="rounded" height={180} />
      <Typography
        variant="caption"
        color="text.muted"
        sx={{ display: 'block', textAlign: 'center', mt: 1.5, fontWeight: 600 }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function savedLabel(saveState: string, lastSavedAt: string | null): string {
  if (saveState === 'saving') return 'Saving…';
  if (!lastSavedAt) return 'Not saved yet';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(lastSavedAt).getTime()) / 1000));
  if (seconds < 10) return 'Saved just now';
  if (seconds < 60) return `Saved ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} min ago`;
  return `Saved ${new Date(lastSavedAt).toLocaleString('en-IN')}`;
}

export default function EstimateWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const estimate = useSelector(selectEstimate);
  const config = useSelector(selectEstimateConfig);
  const { changeSeq, draftNotice, persistence } = useSelector((state) => state.estimate);

  const [recoverable, setRecoverable] = useState<ReturnType<typeof draftStorage.loadLocalDraft>>(null);
  const [serverError, setServerError] = useState<string[] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Steps the advisor has actually tried to leave. A brand-new estimate is
  // empty, not broken — flagging its blanks before anyone has engaged with the
  // form just makes the page look like it is failing.
  const [attemptedSteps, setAttemptedSteps] = useState<number[]>([]);

  const lastAutosavedSeq = useRef(changeSeq);
  const step = estimate.currentStep;
  const isReview = step === 3;

  // ------------------------------------------------------------- bootstrapping
  useEffect(() => {
    void dispatch(loadBusinessConfig());
  }, [dispatch]);

  // Warm the remaining step bundles while the browser is idle so moving
  // between steps never waits on a chunk download.
  useEffect(() => {
    if (typeof window === 'undefined') return () => undefined;
    const preload = () => {
      void import('./steps/InspectionStep');
      void import('./steps/ServicesStep');
      void import('./steps/ReviewStep');
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(preload, 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setAttemptedSteps([]);
    if (id) {
      void dispatch(loadEstimate(id));
      return () => undefined;
    }
    dispatch(resetEstimate());
    const stored = draftStorage.loadLocalDraft();
    const hasContent =
      stored?.state &&
      (stored.state.customer?.name ||
        stored.state.vehicle?.registrationNumber ||
        (stored.state.lineItems || []).length > 0 ||
        (stored.state.inspection || []).some((c) => c.items?.some((i) => i.status !== 'na' || i.notes)));
    setRecoverable(hasContent ? stored : null);
    return () => undefined;
  }, [id, dispatch]);

  // -------------------------------------------------------------- validation
  const stepResults = useMemo(
    () =>
      ESTIMATE_STEPS.map((_stepDef, index) => {
        const validator = stepValidator(index);
        return validator(estimate, config);
      }),
    [estimate, config]
  );

  const stepValidity = useMemo(
    () => Object.fromEntries(stepResults.map((r, index) => [index, r.valid])) as Record<number, boolean>,
    [stepResults]
  );
  // Issues are only surfaced for a step once the advisor has engaged with it —
  // either by trying to move on from it, or by having completed it earlier.
  const stepIssueCount = useMemo(() => {
    const completed = estimate.completedSteps || [];
    return Object.fromEntries(
      stepResults.map((result, index) => {
        const engaged = attemptedSteps.includes(index) || completed.includes(index);
        const issues = result.summary.length || Object.keys(result.errors).length;
        return [index, engaged ? issues : 0];
      })
    ) as Record<number, number>;
  }, [stepResults, attemptedSteps, estimate.completedSteps]);

  const generationValidation = useMemo(() => validateEstimateForGeneration(estimate, config), [estimate, config]);

  // --------------------------------------------------------------- persistence
  const persist = useCallback(
    async (silent = true) => {
      const result: any = await dispatch(saveDraft({ silent }));
      if (saveDraft.fulfilled.match(result)) {
        if (!silent && result.payload.ok) {
          dispatch(showToast({ severity: 'success', message: 'Draft saved' }));
        }
        if (!result.payload.ok && !silent) {
          dispatch(showToast({ severity: 'warning', message: result.payload.message }));
        }
      }
    },
    [dispatch]
  );

  // Debounced autosave — keyed on the edit sequence so the save itself never
  // re-triggers it.
  const debouncedSeq = useDebounce(changeSeq, 1500);
  useEffect(() => {
    if (estimate.loadingDraft) return;
    if (debouncedSeq === lastAutosavedSeq.current) return;
    lastAutosavedSeq.current = debouncedSeq;
    void persist(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSeq, estimate.loadingDraft]);

  // Never lose work to a refresh or a closed tab.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!estimate.dirty) return;
      draftStorage.saveLocalDraft(estimate, estimate.draftId || 'local');
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [estimate]);

  // Keyboard: Ctrl/Cmd+S saves, Alt+Left/Right move between steps.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void persist(false);
        return;
      }
      if (event.altKey && event.key === 'ArrowRight' && !typing) {
        event.preventDefault();
        dispatch(advanceStep());
      }
      if (event.altKey && event.key === 'ArrowLeft' && !typing) {
        event.preventDefault();
        dispatch(goBackStep());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, persist]);

  // --------------------------------------------------------------- navigation
  const scrollTop = () => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContinue = async () => {
    const result = stepResults[step];
    if (!result.valid) {
      setAttemptedSteps((previous) => (previous.includes(step) ? previous : [...previous, step]));
      dispatch(setStepErrors(result.errors));
      dispatch(
        showToast({
          severity: 'error',
          message: `Please fix ${result.summary.length || Object.keys(result.errors).length} item(s) in ${
            ESTIMATE_STEPS[step].label
          } before continuing`,
        })
      );
      scrollTop();
      return;
    }
    dispatch(clearErrors());
    dispatch(advanceStep());
    scrollTop();
    void persist(true);
  };

  const handleBack = () => {
    if (step === 0) {
      if (estimate.dirty) {
        setConfirmLeave(true);
        return;
      }
      navigate('/estimates');
      return;
    }
    dispatch(goBackStep());
    dispatch(clearErrors());
    scrollTop();
  };

  const handleGenerate = async () => {
    const result = generationValidation;
    if (!result.valid) {
      dispatch(setStepErrors(result.errors));
      dispatch(showToast({ severity: 'error', message: 'Cannot generate estimate — please fix the listed problems' }));
      scrollTop();
      return;
    }
    setServerError(null);
    const action: any = await dispatch(generateEstimate());
    if (generateEstimate.fulfilled.match(action)) {
      dispatch(showToast({ severity: 'success', message: `Estimate generated · ${action.payload?.doc?.estimateNumber || ''}` }));
      draftStorage.clearLocalDraft(estimate.draftId || undefined);
      scrollTop();
      return;
    }
    const payload = action.payload || {};
    const details = Array.isArray(payload.errors) ? payload.errors.map((e: any) => e.message || String(e)) : null;
    setServerError(details?.length ? details : [payload.error || 'We could not generate the estimate. Your draft has been saved.']);
    dispatch(showToast({ severity: 'error', message: payload.error || 'We could not generate the estimate.' }));
    void persist(true);
    scrollTop();
  };

  // ------------------------------------------------------------- draft resume
  const handleRecoverDraft = () => {
    if (recoverable?.state) {
      dispatch(hydrateEstimate(recoverable.state));
      dispatch(showToast({ severity: 'success', message: 'Unsaved draft restored' }));
    }
    setRecoverable(null);
  };

  const handleDiscardDraft = () => {
    draftStorage.clearLocalDraft(recoverable?.id);
    setRecoverable(null);
    setAttemptedSteps([]);
    dispatch(resetEstimate());
    dispatch(showToast({ severity: 'info', message: 'Local draft discarded' }));
  };

  const StepComponent = STEP_COMPONENTS[Math.min(step, STEP_COMPONENTS.length - 1)];
  const headline = id ? 'Estimate' : 'Create Estimate';
  const saving = estimate.saveState === 'saving';
  const offline = persistence === 'local';

  return (
    <Box>
      {/* ------------------------------- header ------------------------------- */}
      <Box sx={{ mb: 2.5 }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 0.5, ml: -0.5 }}>
          Back to Estimates
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptLongOutlinedIcon color="primary" />
              <Typography variant="h5" fontWeight={800}>
                {headline}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {estimate.metadata.estimateNumber
                ? `${estimate.metadata.estimateNumber} · ${estimate.status}`
                : 'A new estimate is created as a draft and stored automatically'}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title="Autosave keeps a copy in this browser and on the server">
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: 2, bgcolor: 'background.subtle' }}
                aria-live="polite"
              >
                {saving ? (
                  <CircularProgress size={14} />
                ) : offline ? (
                  <CloudOffOutlinedIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                ) : (
                  <CloudDoneOutlinedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                )}
                <Typography variant="caption" fontWeight={600}>
                  {savedLabel(estimate.saveState, estimate.lastSavedAt)}
                </Typography>
              </Box>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
              onClick={() => void persist(false)}
              disabled={saving}
              size={isMobile ? 'small' : 'medium'}
            >
              Save Draft
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* --------------------------- notices & alerts -------------------------- */}
      {recoverable && (
        <InlineAlert
          severity="info"
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={handleRecoverDraft}>
                Recover
              </Button>
              <Button size="small" onClick={handleDiscardDraft}>
                Discard
              </Button>
            </Stack>
          }
        >
          An unsaved draft from{' '}
          <strong>{recoverable.savedAt ? new Date(recoverable.savedAt).toLocaleString('en-IN') : 'earlier'}</strong> was found in this
          browser. Recover it to continue where you left off.
        </InlineAlert>
      )}

      {draftNotice && (
        <InlineAlert severity="warning" onClose={() => dispatch(setDraftNotice(null))}>
          {draftNotice}
        </InlineAlert>
      )}

      {serverError && (
        <Alert severity="error" onClose={() => setServerError(null)} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={800}>
            We couldn't generate the estimate. Your draft has been saved. Please try again.
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {serverError.map((message, index) => (
              <li key={`${message}-${index}`}>
                <Typography variant="body2">{message}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      {/* ------------------------------ stepper ------------------------------- */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2.5, borderRadius: 3 }}>
        <EstimateStepper
          currentStep={step}
          maxStepReached={estimate.maxStepReached}
          completedSteps={estimate.completedSteps}
          stepValidity={stepValidity}
          stepIssueCount={stepIssueCount}
          onStepSelect={(next) => {
            dispatch(setCurrentStep(next));
            dispatch(clearErrors());
            scrollTop();
          }}
        />
        <Divider sx={{ mb: 1.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{ESTIMATE_STEPS[step].label}</strong> — step {step + 1} of {ESTIMATE_STEPS.length}
          </Typography>
          {estimate.draftId && (
            <Typography variant="caption" color="text.muted">
              Draft ID {String(estimate.draftId).slice(-8)}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* ---------------------------- step content --------------------------- */}
      {/* A failed lazy chunk must degrade to a recoverable message: without a
          boundary React unmounts the whole app and leaves a blank page. */}
      <ErrorBoundary
        title="This step could not be loaded"
        message="Your draft is stored in this browser, so nothing is lost. Reload the page to try again — a stale bundle after a code update is the usual cause."
      >
        {estimate.loadingDraft ? (
          <StepSkeleton label="Loading the saved estimate…" />
        ) : (
          <Suspense fallback={<StepSkeleton />}>
            {isReview ? (
              <ReviewStep
                validation={generationValidation}
                onGenerate={handleGenerate}
                generating={estimate.generating}
                generated={estimate.generated}
              />
            ) : (
              <StepComponent />
            )}
          </Suspense>
        )}
      </ErrorBoundary>

      {/* ---------------------------- sticky footer --------------------------- */}
      <Paper
        elevation={6}
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 2.5,
          mx: -1,
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          borderRadius: 3,
          zIndex: 5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack} size={isMobile ? 'small' : 'medium'}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          {!isMobile && (
            <Typography variant="caption" color="text.muted">
              {estimate.lineItems.length} item{estimate.lineItems.length === 1 ? '' : 's'} · Grand total{' '}
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: config.currency || 'INR', maximumFractionDigits: 0 }).format(
                estimate.totals.grandTotal
              )}
            </Typography>
          )}

          {isReview ? (
            <Button
              variant="contained"
              size={isMobile ? 'small' : 'large'}
              onClick={handleGenerate}
              disabled={!generationValidation.valid || estimate.generating || estimate.generated}
            >
              {estimate.generating ? 'Generating…' : estimate.generated ? 'Estimate Generated' : 'Generate Estimate'}
            </Button>
          ) : (
            <Button
              variant="contained"
              size={isMobile ? 'small' : 'large'}
              endIcon={<ArrowForwardIcon />}
              onClick={handleContinue}
            >
              Save &amp; Continue
            </Button>
          )}
        </Box>
      </Paper>

      {/* -------------------------- unsaved changes guard --------------------- */}
      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message={`Your draft has been stored in this browser${
          persistence === 'server' ? ' and on the server' : ''
        }. Leave the estimate anyway?`}
        confirmLabel="Leave"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          navigate('/estimates');
        }}
        onClose={() => setConfirmLeave(false)}
      />
    </Box>
  );
}
