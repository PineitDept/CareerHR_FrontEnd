export interface AlertDialogData {
  title?: string;
  message: string;
  confirm?: boolean;
  selectedRows?: any[];
  columns?: any[];
  poType?: string[];
  quality?: number;
}

export interface FormDialogData {
  title?: string;
  message: string;
  confirm?: boolean;
  selectedRows?: any[];
  columns?: any[];
  labelInput?: string[];
  valInput?: string[];
  isEditMode?: boolean;
}