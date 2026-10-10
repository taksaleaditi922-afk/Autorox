import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid, Tabs, Tab, Divider,
} from '@mui/material';
import api from '../../services/api';
import Loader from '../../components/Loader';
import { showToast } from '../../redux/uiSlice';
import { useDispatch } from 'react-redux';
import useT from '../../i18n/useT';

export default function Settings() {
  const dispatch = useDispatch();
  const t = useT();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    api.get('/settings')
      .then((res) => setSettings(res.data.data))
      .catch(err => setError(err?.response?.data?.error || 'Unable to load settings. Please reload to try again.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      dispatch(showToast({ severity: 'success', message: t('settings.saved') }));
    } catch (err) {
      dispatch(showToast({ severity: 'error', message: err.response?.data?.error || t('common.failedSave') }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label={t('common.loadingSettings')} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!settings) return null;

  const setCompany = (field, value) => setSettings((s) => ({ ...s, company: { ...s.company, [field]: value } }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('settings.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{t('settings.subtitle')}</Typography>
        </Box>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? t('action.saving') : t('action.saveChanges')}
        </Button>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab icon={<span style={{ fontSize: 18 }}>🏢</span>} iconPosition="start" label={t('settings.tabCompany')} />
            <Tab icon={<span style={{ fontSize: 18 }}>⚙️</span>} iconPosition="start" label={t('settings.tabSystem')} />
          </Tabs>
        </Box>

        {tab === 0 && (
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>{t('settings.companyInfo')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('settings.companyInfoSubtitle')}</Typography>
            </Box>
            <Grid container spacing={2.5}>
              <Grid item xs={12}>
                <TextField fullWidth label={t('settings.companyName')} value={settings.company?.name || ''} onChange={(e) => setCompany('name', e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label={t('settings.address')} value={settings.company?.address || ''} onChange={(e) => setCompany('address', e.target.value)} multiline minRows={2} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label={t('settings.email')} value={settings.company?.email || ''} onChange={(e) => setCompany('email', e.target.value)} type="email" />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label={t('settings.phone')} value={settings.company?.phone || ''} onChange={(e) => setCompany('phone', e.target.value)} />
              </Grid>
            </Grid>
          </CardContent>
        )}

        {tab === 1 && (
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>{t('settings.systemDefaults')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('settings.systemDefaultsSubtitle')}</Typography>
            </Box>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label={t('settings.taxRate')} type="number" value={settings.taxRate || 0} onChange={(e) => setSettings((s) => ({ ...s, taxRate: +e.target.value }))} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label={t('settings.currency')} value={settings.currency || 'INR'} onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))} />
              </Grid>
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} mb={0.5}>{t('settings.serviceTypes')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('settings.serviceTypesSubtitle')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {(settings.serviceTypes || []).map((st, i) => (
                <Box key={i} sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, border: '1px solid', borderColor: st.isActive ? 'primary.main' : 'divider', bgcolor: st.isActive ? 'rgba(15,23,42,0.04)' : 'transparent', fontSize: '0.8125rem', fontWeight: 600, color: st.isActive ? 'primary.main' : 'text.muted' }}>
                  {st.name}
                </Box>
              ))}
              {(!settings.serviceTypes || settings.serviceTypes.length === 0) && (
                <Typography variant="body2" color="text.secondary">{t('settings.noServiceTypes')}</Typography>
              )}
            </Box>
          </CardContent>
        )}
      </Card>
    </Box>
  );
}