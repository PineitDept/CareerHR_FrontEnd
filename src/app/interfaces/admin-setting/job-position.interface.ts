export interface JobPositionDetails {
  idjobPst: number;
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
