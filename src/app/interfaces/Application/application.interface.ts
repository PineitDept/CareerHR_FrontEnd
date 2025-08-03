export interface ICandidateFilterRequest {
  statusGroup?: string;
  status?: string;
  year?: string;
  month?: string;
  search?: string;
  grade?: string;
  universityId?: number;
  position?: string;
  page: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  sortFields?: string;
}

export interface ICandidateTrackingFilterRequest {
  status?: string;
  year?: string;
  month?: string;
  grade?: string;
  search?: string;
  interview1?: number[];
  interview2?: number[];
  offer?: number[];
  hired?: number[];
  page: number;
  pageSize?: number;
  sortFields?: string;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}
// Types & export interfaces
export interface TabMenu {
  readonly key: string;
  readonly label: string;
  count: number;
}

export interface ApplicationRow {
  readonly id: string;
  readonly qualifield: IconConfig;
  readonly submitDate: string;
  readonly userID: string;
  readonly fullName: string;
  readonly position: string[];
  readonly university: string;
  readonly gpa: string;
  readonly gradeCandidate: string;
  readonly totalCandidatePoint: string;
  readonly bdPoint: number;
  readonly gpaScore: number;
  readonly eqScore: number;
  readonly ethicsScore: number;
  readonly totalBonus: number;
  readonly submitStatusLabel: BadgeConfig;
}
export interface ScreeningRow {
  readonly id: string;
  readonly submitDate: string;
  readonly userID: string;
  readonly fullName: string;
  readonly position: string[];
  readonly university: string;
  readonly gpa: string;
  readonly gradeCandidate: string;
  readonly totalCandidatePoint: string;
  readonly bdPoint: number;
  readonly gpaScore: number;
  readonly eqScore: number;
  readonly ethicsScore: number;
  readonly totalBonus: number;
  readonly employeeAction: string;
  readonly screening: BadgeConfig;
}

export interface IconConfig {
  readonly icon: string;
  readonly fill?: string;
  readonly size?: string;
  readonly extraClass?: string;
}

export interface BadgeConfig {
  readonly label: string;
  readonly class: readonly string[];
}

export interface DateRange {
   month: string;
   year: string;
}

export interface SearchForm {
  readonly searchBy: string;
  readonly searchValue: string;
}

// Import actual types from your export interfaces
export interface StatusGroupCount {
  [key: string]: number | undefined;
}

export interface CandidatePagedResult<T> {
  readonly page: number;
  readonly hasNextPage: boolean;
  readonly totalItems: number;
  readonly statusGroupCount: StatusGroupCount;
  readonly items: readonly T[];
}

export interface ICandidateWithPositionsDto {
  summary: ICandidateSummaryDto;
  positions: IPositionDto[];
}

export interface ICandidateSummaryDto {
  userID: number;
  statusCSD: number;
  screening: string;
  fullName: string;
  fullNameTH: string;
  submitDate?: string;
  submitDateFormatted?: string;
  daysSinceSubmit?: number;
  submitStatusLabel: string;
  uniID?: number;
  university: string;
  bdPoint: number;
  gpa?: number;
  gpaScore: number;
  eqPoint?: number;
  eqScore: number;
  ethicsPoint?: number;
  ethicsScore: number;
  totalCandidatePoint: number;
  qualifield: number;
  gradeCandidate: string;
  bonusLang?: number;
  bonusCP: number;
  totalBonus: number;
  employeeId?: number;
  employeeAction?: string;
}

export interface IPositionDto {
  idjobPST?: number;
  namePosition: string;
}

// Type alias for the actual API response
export type ApiResponse = CandidatePagedResult<ICandidateWithPositionsDto>;
