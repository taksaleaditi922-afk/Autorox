import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert,
  InputAdornment, IconButton, CircularProgress, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, LinearProgress,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { login, clearError } from '../../redux/authSlice';
import api from '../../services/api';
import { showToast } from '../../redux/uiSlice';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import useT from '../../i18n/useT';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useT();
  const { loading, error } = useSelector((state) => state.auth);
  const [email, setEmail] = useState('admin@autorox.in');
  const [password, setPassword] = useState('AutoRox#2024');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await dispatch(login({ email, password }));
    if (login.fulfilled.match(res)) {
      dispatch(showToast({ severity: 'success', message: t('login.welcomeToast') }));
      navigate('/');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangeError('');
    if (newPassword !== confirmPassword) {
      setChangeError(t('login.passwordMismatch'));
      return;
    }
    setChangeLoading(true);
    try {
      await api.post('/auth/change-password', { email, currentPassword, newPassword });
      setPassword(newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangeOpen(false);
      dispatch(showToast({ severity: 'success', message: t('login.passwordChanged') }));
    } catch (err) {
      setChangeError(err.response?.data?.error || t('login.changeFailed'));
    } finally {
      setChangeLoading(false);
    }
  };

  const closeChangePassword = () => {
    setChangeOpen(false);
    setChangeError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const passwordScore = [
    newPassword.length >= 8,
    /[A-Z]/.test(newPassword),
    /[0-9]/.test(newPassword),
    /[^A-Za-z0-9]/.test(newPassword),
  ].filter(Boolean).length;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
        <LanguageSwitcher color="default" iconColor="#e2e8f0" />
      </Box>
      <Box sx={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
      <Box sx={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />

      <Card sx={{ maxWidth: 420, width: '100%', borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative', zIndex: 1 }} className="fade-in-up">
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 2.5,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              mb: 2, boxShadow: '0 4px 16px rgba(15,23,42,0.3)',
            }}>
              <DirectionsCarIcon sx={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ letterSpacing: '-0.02em' }}>AutoGarage</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8125rem' }}>{t('login.systemName')}</Typography>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h6" fontWeight={700} mb={0.5}>{t('login.welcome')}</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>{t('login.subtitle')}</Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label={t('login.email')} type="email" fullWidth required
              value={email} onChange={(e) => setEmail(e.target.value)} margin="normal" autoComplete="email"
              InputProps={{ startAdornment: (<InputAdornment position="start"><EmailOutlinedIcon fontSize="small" color="action" /></InputAdornment>) }}
            />
            <TextField
              label={t('login.password')} type={showPw ? 'text' : 'password'} fullWidth required
              value={password} onChange={(e) => setPassword(e.target.value)} margin="normal" autoComplete="current-password"
              InputProps={{
                startAdornment: (<InputAdornment position="start"><LockOutlinedIcon fontSize="small" color="action" /></InputAdornment>),
                endAdornment: (<InputAdornment position="end"><IconButton onClick={() => setShowPw(!showPw)} edge="end" size="small">{showPw ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment>),
              }}
            />
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ mt: 3, py: 1.4, borderRadius: 2, fontSize: '0.9375rem' }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : t('action.signIn')}
            </Button>
          </Box>

          <Button size="small" variant="text" onClick={() => setChangeOpen(true)} sx={{ display: 'block', mx: 'auto', mt: 1 }}>{t('action.changePassword')}</Button>

          <Box sx={{ mt: 3, p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('login.demoCredentials')}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>admin@autorox.in / AutoRox#2024</Typography>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={changeOpen} onClose={closeChangePassword} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          {t('login.changeTitle')}
          <IconButton aria-label="Close" onClick={closeChangePassword} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={handleChangePassword}>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{t('login.changeHint')}</Typography>
            {changeError && <Alert severity="error" sx={{ mb: 1.5 }}>{changeError}</Alert>}
            <TextField label={t('login.currentPassword')} type="password" fullWidth required size="small" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} margin="dense" autoComplete="current-password" />
            <TextField label={t('login.newPassword')} type="password" fullWidth required size="small" inputProps={{ minLength: 6 }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} margin="dense" autoComplete="new-password" />
            {newPassword && <>
              <LinearProgress variant="determinate" value={passwordScore * 25} color={passwordScore < 3 ? 'warning' : 'success'} sx={{ mt: 1, mb: 0.5, height: 4, borderRadius: 2 }} />
              <Typography variant="caption" color="text.secondary">{t('login.passwordStrength')}</Typography>
            </>}
            <TextField label={t('login.confirmPassword')} type="password" fullWidth required size="small" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} margin="dense" autoComplete="new-password" />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeChangePassword} color="inherit">{t('action.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={changeLoading}>{changeLoading ? <CircularProgress size={20} color="inherit" /> : t('action.savePassword')}</Button>
          </DialogActions>
        </Box>
      </Dialog>

    </Box>
  );
}