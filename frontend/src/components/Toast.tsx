import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Alert, Snackbar } from '@mui/material';
import { clearToast } from '../redux/uiSlice';

export default function Toast() {
  const toast = useSelector((state) => state.ui.toast);
  const dispatch = useDispatch();

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