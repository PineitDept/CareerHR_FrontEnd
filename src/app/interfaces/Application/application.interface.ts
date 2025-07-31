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
export interface ICandidateWithPositionsDto {
  summary: ICandidateSummaryDto;
  positions: IPositionDto[];
}
export interface ICandidateFilterRequest {
  statusGroup?: string;
  status?: string;
  year?: string;
  month?: string;
  search?: string;
  grade?: string;
  universityId?: number;
  position?: string;
  page: number ;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  sortFields?: string;
}