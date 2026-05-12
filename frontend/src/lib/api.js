import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 30000 });

// Centralised error message extractor
export function apiError(err, fallback = 'Something went wrong') {
  if (err?.response?.data?.detail) {
    const d = err.response.data.detail;
    return typeof d === 'string' ? d : JSON.stringify(d);
  }
  return err?.message || fallback;
}
