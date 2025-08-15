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

export interface BenefitStatus {
  activeStatus: boolean;
  status: number;
}

// Type alias for the actual API response
export type ApiResponse = IBenefitsWithPositionsDto[];