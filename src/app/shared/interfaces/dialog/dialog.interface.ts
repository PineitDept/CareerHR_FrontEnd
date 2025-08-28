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

export interface ConfirmChangesData {
  title?: string;
  groups: Array<{
    section: string;
    items: Array<{
      entity: 'Category' | 'CategoryName' | 'Detail';
      id?: string | number | null;
      label: string;
      field: string; // '__index', 'questionTH', 'type', ...
      from: any;
      to: any;
    }>;
  }>;
  confirm?: boolean;         // default: true
  message?: string;          // optional note
}
