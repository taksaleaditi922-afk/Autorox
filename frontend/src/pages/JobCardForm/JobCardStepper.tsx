// ---------------------------------------------------------------------------
// Step progress for the six-step job card wizard.
//
// Completed steps can be re-opened without losing data; later steps stay
// locked until the required validation for the current one passes.
// ---------------------------------------------------------------------------

import { Box, LinearProgress, Step, StepButton, StepLabel, Stepper, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { JOB_CARD_STEPS } from '../../utils/jobCard';

export interface JobCardStepperProps {
  currentStep: number;
  maxStepReached: number;
  completedSteps: number[];
  stepValidity: Record<number, boolean>;
  stepIssueCount: Record<number, number>;
  onStepSelect: (step: number) => void;
}

export default function JobCardStepper({
  currentStep,
  maxStepReached,
  completedSteps,
  stepValidity,
  stepIssueCount,
  onStepSelect,
}: JobCardStepperProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const progress = ((currentStep + 1) / JOB_CARD_STEPS.length) * 100;

  if (isMobile) {
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={800}>
            Step {currentStep + 1} of {JOB_CARD_STEPS.length} · {JOB_CARD_STEPS[currentStep].short}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Stepper nonLinear activeStep={currentStep} alternativeLabel sx={{ mb: 1, '& .MuiStepConnector-line': { borderColor: 'primary.main' } }}>
      {JOB_CARD_STEPS.map((step, index) => {
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
                  ? `${issues} item${issues === 1 ? '' : 's'} need attention`
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
                            ? 'primary.main'
                            : isComplete
                            ? 'success.main'
                            : index === currentStep
                            ? 'primary.main'
                            : 'divider',
                          bgcolor: isComplete ? 'success.main' : index === currentStep ? 'primary.main' : 'background.paper',
                          color: isComplete || index === currentStep ? '#fff' : 'primary.main',
                        }}
                      >
                        {isComplete ? (
                          <CheckCircleIcon sx={{ fontSize: 18 }} />
                        ) : (
                          index + 1
                        )}
                      </Box>
                    )}
                  >
                    <Typography variant="body1" fontWeight={600} sx={{ display: 'block', maxWidth: 200, mx: 'auto', mt: 0.5 }}>
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
