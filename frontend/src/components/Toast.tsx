import { useEffect } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { clearToast } from '../redux/uiSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export default function Toast() {
  const toast = useAppSelector((state) => state.ui.toast);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => dispatch(clearToast()), 4000);
      return () => clearTimeout(t);
    }
  }, [toast, dispatch]);

  return (
    <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => dispatch(clearToast())} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
      <Alert
        onClose={() => dispatch(clearToast())}
        severity={toast?.severity || 'info'}
        sx={{ width: '100%', minWidth: 280 }}
      >
        {toast?.message}
      </Alert>
    </Snackbar>
  );
}