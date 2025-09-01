export interface JobPositionDetails {
  idjobPst?: number;
  namePosition?: string | null;
  workingDetails: number;
  experienceMin: number;
  experienceMax: number;
  ideducation?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  showSalary: number;
  quality: number;
  status: number;

  locations?: number[] | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  preferredSkills?: string[] | null;
  benefits?: number[] | null;
  computerSkills?: number[] | null;
  languageSkills?: number[] | null;
}

export interface DropdownOverlay {
  visible: boolean;
  rowIndex: number | null; // null = footer
  field: string;
  x: number;
  y: number;
  width: number;
  options: string[];
}