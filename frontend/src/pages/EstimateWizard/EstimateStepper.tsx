// ---------------------------------------------------------------------------
// Step progress.
//
// Shows the current step, completed steps, upcoming steps and the validation
// status of each. Completed steps can be re-opened without losing data;
// upcoming steps stay locked so required validation cannot be skipped.
// ---------------------------------------------------------------------------

import { Box, LinearProgress, Step, StepButton, StepLabel, Stepper, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { ESTIMATE_STEPS } from '../../utils/estimateValidation';

export interface EstimateStepperProps {
  currentStep: number;
  maxStepReached: number;
  completedSteps: number[];
  /** Step index -> true when that step currently validates. */
  stepValidity: Record<number, boolean>;
  /** Step index -> number of validation problems (0 when valid). */
  stepIssueCount: Record<number, number>;
  onStepSelect: (step: number) => void;
}

export default function EstimateStepper({
  currentStep,
  maxStepReached,
  completedSteps,
  stepValidity,
  stepIssueCount,
  onStepSelect,
}: EstimateStepperProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const progress = ((currentStep + 1) / ESTIMATE_STEPS.length) * 100;

  if (isMobile) {
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={800}>
            Step {currentStep + 1} of {ESTIMATE_STEPS.length} · {ESTIMATE_STEPS[currentStep].label}
          </Typography>
          <Typography variant="caption" color="text.muted">
            {Math.round(progress)}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Stepper nonLinear activeStep={currentStep} alternativeLabel sx={{ mb: 1 }}>
      {ESTIMATE_STEPS.map((step, index) => {
        const isComplete = completedSteps.includes(index) && stepValidity[index] !== false;
        const isLocked = index > maxStepReached;
        const issues = stepIssueCount[index] || 0;

        return (
          <Step key={step.key} completed={isComplete}>
            <Tooltip
              title={
                isLocked
                  ? 'Complete the previous steps to unlock'
                  : issues
                  ? `${issues} item${issues === 1 ? '' : 's'} need${issues === 1 ? 's' : ''} attention`
                  : isComplete
                  ? 'Completed'
                  : 'In progress'
              }
            >
              <span>
                <StepButton onClick={() => !isLocked && onStepSelect(index)} disabled={isLocked}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Box
                        aria-hidden="true"
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          border: '2px solid',
                          borderColor: isLocked
                            ? 'divider'
                            : isComplete
                            ? 'success.main'
                            : index === currentStep
                            ? 'primary.main'
                            : 'divider',
                          bgcolor: isComplete ? 'success.main' : index === currentStep ? 'primary.main' : 'background.paper',
                          color: isComplete || index === currentStep ? '#fff' : 'text.muted',
                        }}
                      >
                        {isComplete ? (
                          <CheckCircleIcon sx={{ fontSize: 18 }} />
                        ) : isLocked ? (
                          <LockOutlinedIcon sx={{ fontSize: 15 }} />
                        ) : (
                          index + 1
                        )}
                      </Box>
                    )}
                  >
                    <Typography variant="caption" fontWeight={700} sx={{ display: 'block' }}>
                      {step.label}
                    </Typography>
                    {issues > 0 && index === currentStep && (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'error.main' }}>
                        <ErrorOutlineIcon sx={{ fontSize: 13 }} />
                        <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>
                          {issues} to fix
                        </Typography>
                      </Box>
                    )}
                  </StepLabel>
                </StepButton>
              </span>
            </Tooltip>
          </Step>
        );
      })}
    </Stepper>
  );
}
