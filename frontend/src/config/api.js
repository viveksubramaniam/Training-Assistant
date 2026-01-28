/**
 * API Configuration
 * 
 * Exports the base URL for API requests.
 * 
 * In development (Vite), import.meta.env.VITE_API_URL is typically undefined,
 * so this defaults to an empty string ''. This allows the Vite proxy (configured in vite.config.js)
 * to handle requests to '/api/...' by forwarding them to the local backend (localhost:3000).
 * 
 * In production (e.g., Vercel), VITE_API_URL should be set to the absolute URL of the backend.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
