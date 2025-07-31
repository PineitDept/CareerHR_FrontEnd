// Model for handling errors from backend or network
export interface ApiError {
  status: number;                 // HTTP status code
  message: string;               // Friendly or fallback message
  error?: any;                   // Raw error object from backend
  type?: 'Validation' | 'Unauthorized' | 'Forbidden' | 'NotFound' | 'Server' | 'Network';

  // Optional enhancements
  timestamp?: string;            // Time of error (ISO string)
  path?: string;                 // API path where the error occurred
  details?: any;                 // Extra error details (e.g., validation messages)
}
