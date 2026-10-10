import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground { subtle: string; }
  interface TypeText { muted: string; }
  interface Palette { accent: Palette['primary']; }
  interface PaletteOptions { accent?: PaletteOptions['primary']; }
}
