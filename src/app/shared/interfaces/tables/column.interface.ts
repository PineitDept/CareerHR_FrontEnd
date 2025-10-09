type TableCellType = 'text' | 'badge' | 'number' | 'select' | 'button' | 'date' | 'dateWithTime' | 'list' | 'icon' | 'expandable' | 'toggle' | 'textlink' | 'textlink-custom' | 'input' | 'multipleselect' | 'dynamic'; // Column type

export interface Column {
  header: string;           // Displayed column header name
  field: string;           // Field name to map with row data
  type?: TableCellType;     // Column type
  typeFn?: (row: any) => TableCellType;
  textlinkActions?: Array<'view' | 'edit-topopup' | 'edit-inrow' | 'save' | 'cancel' | 'delete'>; // type: textlink
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  align?: 'left' | 'center' | 'right';        // Alignment of the column
  wrapText?: boolean;       // Allow text to wrap
  mainColumn?: string;
  subColumn?: string;

  // Type-specific properties
  options?: string[];       // Options for select type
  buttonText?: string;      // Button label (if type is button)
  onClick?: (row: any) => void; // Callback when button is clicked

  // Sortable
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;

  editing?: boolean;

  useRowTextlinkActions?: boolean;

  // textlink-custom
  iconLink?: string
}

export type Columns = Column[];
