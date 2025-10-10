// ================== Request/Filter ==================
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

// ================== UI/Rows ==================
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
  readonly roundID?: number;
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
  readonly roundID?: number;
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

// ================== Paged Result (API Response wrapper) ==================
export interface StatusGroupCount {
  [key: string]: number | undefined;
}

export interface StatusCounts {
  [key: string]: number | undefined;
}

export interface CandidatePagedResult<T> {
  readonly totalItems: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly statusGroupCount: StatusGroupCount;
  readonly statusCounts: StatusCounts;
  readonly groupCounts?: any | null;
  readonly items: readonly T[];
}

// ================== Item/DTO ==================
export interface ICandidateWithPositionsDto {
  userID: number;
  roundID?: number;
  summary: ICandidateSummaryDto;
  positions: IPositionDto[];
}

export interface ICandidateSummaryDto {
  userID?: number;

  statusCSD: number;
  screening: string;
  fullName: string;
  fullNameTH: string;

  submitDate?: string;
  submitDateFormatted?: string;
  daysSinceSubmit?: number;
  submitStatusLabel?: string;

  email?: string;
  phoneNumber?: string;

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
  bonusCP?: number;
  totalBonus: number;

  employeeId?: number;
  employeeAction?: string;
  employeeActionDate?: string;
  daysSinceEmployeeActionDate?: number;
}

export interface IPositionDto {
  iDjobPST?: number; // ตาม payload จริง
  idjobPST?: number; // กันเคสสะกดต่าง
  namePosition: string;
}

export type ApiResponse = CandidatePagedResult<ICandidateWithPositionsDto>;
