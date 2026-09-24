import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplayIcon from '@mui/icons-material/Replay';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Headline shown when the subtree fails. */
  title?: string;
  /** Extra guidance, e.g. whether the user's work is safe. */
  message?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time failures in a subtree.
 *
 * A lazy route chunk that fails to load would otherwise unmount the whole app,
 * so a boundary like this is what keeps one broken section from taking the
 * whole page down with it.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the technical detail in the console for support; show plain language
    // to the user.
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleRetry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, title = 'Something went wrong', message } = this.props;

    if (!error) return children;

    return (
      <Box role="alert" sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}>
        <Typography variant="h6" color="error" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {message || 'An unexpected error occurred while rendering this section.'}
        </Typography>
        <Typography
          variant="caption"
          color="text.muted"
          component="pre"
          sx={{ display: 'block', whiteSpace: 'pre-wrap', mb: 2, fontFamily: 'monospace' }}
        >
          {error.message}
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center">
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button variant="outlined" startIcon={<ReplayIcon />} onClick={this.handleRetry}>
            Try again
          </Button>
        </Stack>
      </Box>
    );
  }
}
