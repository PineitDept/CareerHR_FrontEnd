import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../shared/services/api/api.service';

@Injectable({
  providedIn: 'root'
})
export class InterviewDetailsFormService {
  private baseForm = 'Form'; // Base endpoint

  constructor(private api: ApiService) { }

  // Utility function to clean empty or null values from objects
  private clean(obj: Record<string, any>) {
    const out: Record<string, any> = {};
    Object.keys(obj).forEach(k => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  // Get list of forms
  getForms<T>(params?: Record<string, any>): Observable<T> {
    const query = this.clean(params || {});
    return this.api.get<T>(`${this.baseForm}`, { params: query, withAuth: true, loading: true });
  }

  // Create a new form
  createForm<T>(body: Record<string, any>): Observable<T> {
    return this.api.post<T>(`${this.baseForm}`, body, { withAuth: true, loading: false });
  }

  // Get form details by ID
  getFormById<T>(formId: number): Observable<T> {
    return this.api.get<T>(`${this.baseForm}/${formId}`, { withAuth: true, loading: true });
  }

  // Update form by ID
  updateForm<T>(formId: string, body: Record<string, any>): Observable<T> {
    return this.api.put<T>(`${this.baseForm}/${formId}`, body, { withAuth: true, loading: false });
  }

  // Delete form by ID
  deleteForm<T>(formId: string): Observable<T> {
    return this.api.delete<T>(`${this.baseForm}/${formId}`, { withAuth: true, loading: false });
  }

  // Get fields in a form by form ID
  getFormFields<T>(formId: string): Observable<T> {
    return this.api.get<T>(`${this.baseForm}/${formId}/fields`, { withAuth: true, loading: true });
  }

  // Create a new field in a form
  createField<T>(formId: string, body: Record<string, any>): Observable<T> {
    return this.api.post<T>(`${this.baseForm}/${formId}/fields`, body, { withAuth: true, loading: false });
  }

  // Update a field in a form
  updateField<T>(formId: string, fieldId: string, body: Record<string, any>): Observable<T> {
    return this.api.put<T>(`${this.baseForm}/${formId}/fields/${fieldId}`, body, { withAuth: true, loading: false });
  }

  // Delete a field from a form
  deleteField<T>(formId: string, fieldId: string): Observable<T> {
    return this.api.delete<T>(`${this.baseForm}/${formId}/fields/${fieldId}`, { withAuth: true, loading: false });
  }

  // Reorder fields in a form
  reorderFields<T>(formId: string, body: Record<string, any>): Observable<T> {
    return this.api.put<T>(`${this.baseForm}/${formId}/fields/reorder`, body, { withAuth: true, loading: false });
  }

  // Get field options by field ID
  getFieldOptions<T>(formId: string, fieldId: string): Observable<T> {
    return this.api.get<T>(`${this.baseForm}/${formId}/fields/${fieldId}/options`, { withAuth: true, loading: true });
  }

  // Add options to a field
  createFieldOption<T>(formId: string, fieldId: string, body: Record<string, any>): Observable<T> {
    return this.api.post<T>(`${this.baseForm}/${formId}/fields/${fieldId}/options`, body, { withAuth: true, loading: false });
  }

  // Update field option
  updateFieldOption<T>(formId: string, fieldId: string, optionId: string, body: Record<string, any>): Observable<T> {
    return this.api.put<T>(`${this.baseForm}/${formId}/fields/${fieldId}/options/${optionId}`, body, { withAuth: true, loading: false });
  }

  // Delete a field option
  deleteFieldOption<T>(formId: string, fieldId: string, optionId: string): Observable<T> {
    return this.api.delete<T>(`${this.baseForm}/${formId}/fields/${fieldId}/options/${optionId}`, { withAuth: true, loading: false });
  }

  // Toggle field status (enable/disable)
  toggleFieldStatus<T>(formId: string, fieldId: string, body: Record<string, any>): Observable<T> {
    return this.api.patch<T>(`${this.baseForm}/${formId}/fields/${fieldId}/toggle-status`, body, { withAuth: true, loading: false });
  }

  // Toggle field action (enable/disable)
  toggleFieldAction<T>(formId: string, fieldId: string, body: Record<string, any>): Observable<T> {
    return this.api.patch<T>(`${this.baseForm}/${formId}/fields/${fieldId}/toggle-action`, body, { withAuth: true, loading: false });
  }

  // Save form answers
  saveFormAnswers<T>(body: Record<string, any>): Observable<T> {
    return this.api.post<T>(`${this.baseForm}/save-answers`, body, { withAuth: true, loading: false });
  }

  // Preview form round for a user
  previewFormRound<T>(userId: string): Observable<T> {
    return this.api.get<T>(`${this.baseForm}/round/user/${userId}/preview`, { withAuth: true, loading: true });
  }
}
