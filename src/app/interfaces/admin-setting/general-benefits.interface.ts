export interface IBenefitsFilterRequest {
  page: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  queryParams?: Record<string, any>;
  search?: string;
  sortFields?: string;
  TypeScoreMin?: number;
  TypeScoreMax?: number;
  InterviewResult?: string;
}

export interface IBenefitsWithPositionsDto {
  item: number;
  welfareBenefits: string;
  status: number;
  statusText: string;
  canDelete: boolean;
}

export interface ScreeningRow {
  item: number;
  welfareBenefits: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  activeStatus?: boolean;
}

export interface ISpecialBenefitsWithPositionsDto {
  id: number;
  welfareBenefits: string;
  status: number;
  statusText: string;
  canDelete: boolean;
}

export interface SpecialScreeningRow {
  id: number;
  welfareBenefits: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  activeStatus?: boolean;
}

export interface IComputerWithPositionsDto {
  idcpSkill: number;
  nameCpskill: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  usageCount?: number;
}

export interface ComputerScreeningRow {
  idcpSkill: number;
  nameCpskill: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  usageCount?: number;
  activeStatus?: boolean;
}

export interface ILanguageWithPositionsDto {
  idlanguage: number;
  language: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  usageCount?: number;
}

export interface LanguageScreeningRow {
  idlanguage: number;
  language: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  usageCount?: number;
  activeStatus?: boolean;
}

export interface IUniversityWithPositionsDto {
  id: number;
  uniId: string;
  university: string;
  typeScore: number;
  status: number;
  statusText: string;
  canDelete: boolean;
}

export interface UniversityScreeningRow {
  id: number;
  uniId: string;
  university: string;
  typeScore: string;
  status: number;
  statusText: string;
  canDelete: boolean;
  activeStatus?: boolean;
}

export interface IInterviewrWithPositionsDto {
  idEmployee: number;
  fullName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface InterviewrScreeningRow {
  idEmployee: number;
  fullName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}


export interface IApiResponse<T> {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SearchForm {
  readonly searchBy: string;
  readonly searchValue: string;
}