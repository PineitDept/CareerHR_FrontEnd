export interface AlertDialogData {
  title?: string;
  message: string;
  confirm?: boolean;
  selectedRows?: any[];
  columns?: any[];
  poType?: string[];
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