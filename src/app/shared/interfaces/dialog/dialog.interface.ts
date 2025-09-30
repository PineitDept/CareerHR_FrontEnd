export interface AlertDialogData {
  title?: string;
  message: string;
  confirm?: boolean;
  selectedRows?: any[];
  columns?: any[];
  poType?: string[];
  options?: any[];
  dropdownConfigs?: any[];
  quality?: number;
  missCallCount?: number;
  dataMail?: any;
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
      entity?: string;
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
