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

// Type alias for the actual API response
// export type ApiResponse = IBenefitsWithPositionsDto[];