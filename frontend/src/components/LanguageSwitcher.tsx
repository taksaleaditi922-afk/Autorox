import { useState } from 'react';
import type { IconButtonProps } from '@mui/material';
import { IconButton, Menu, MenuItem, Tooltip, Box } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckIcon from '@mui/icons-material/Check';
import { LANGUAGES } from '../i18n/languages';
import { setLanguage } from '../redux/languageSlice';
import useT from '../i18n/useT';

export default function LanguageSwitcher({ color = 'inherit', iconColor }: { color?: IconButtonProps['color']; iconColor?: string }) {
  const dispatch = useAppDispatch();
  const t = useT();
  const current = useAppSelector((state) => state.language.lang);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleSelect = (code) => {
    dispatch(setLanguage(code));
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={t('action.language')}>
        <IconButton
          color={color}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label={t('action.language')}
          aria-haspopup="true"
        >
          <TranslateIcon fontSize="small" sx={iconColor ? { color: iconColor } : undefined} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { minWidth: 220, mt: 1, py: 0.5 } }}
      >
        {LANGUAGES.map((lang) => {
          const selected = lang.code === current;
          return (
            <MenuItem
              key={lang.code}
              selected={selected}
              onClick={() => handleSelect(lang.code)}
              sx={{
                mx: 0.5,
                borderRadius: 1,
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                py: 1,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <Box sx={{ flexGrow: 1 }}>{lang.label}</Box>
              {selected && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
