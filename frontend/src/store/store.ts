import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../redux/authSlice';
import jobReducer from '../redux/jobSlice';
import uiReducer from '../redux/uiSlice';
import productsReducer from '../redux/productsSlice';
import salesReducer from '../redux/salesSlice';
import languageReducer from '../redux/languageSlice';
import inventoryReducer from '../redux/inventorySlice';
import estimateReducer from '../redux/estimateSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    jobCards: jobReducer,
    ui: uiReducer,
    products: productsReducer,
    sales: salesReducer,
    language: languageReducer,
    inventory: inventoryReducer,
    estimate: estimateReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;