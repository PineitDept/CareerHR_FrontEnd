export interface IUserFilterRequest {
  page: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  queryParams?: any;
  search?: string;
  sortFields?: string;
}

export interface ScreeningRow {
  readonly idEmployee: number;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly type: number;
  // readonly isActive: boolean;
  readonly createdAt: string | null;
  readonly lastLoginAt: string | null;
  readonly fullName: string;
  readonly roles?: IUserRole[];
  activeStatus?: boolean;
}

export interface IconConfig {
  readonly icon: string;
  readonly fill?: string;
  readonly size?: string;
  readonly extraClass?: string;
}

export interface ToggleConfig {
  readonly label: string;
  readonly class: readonly string[];
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

export interface UserPagedResult<T> {
  total: any;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  groupCounts: any;
  items: T[];
}

export interface statusCounts {
  [key: string]: number | undefined;
}

export interface IUserRole {
  id: number;
  name: string;
  createdAt: string | null;
}

export interface IUserWithPositionsDto {
  idEmployee: number;
  email: string;
  firstName: string;
  lastName: string;
  type: number;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  fullName: string;
  roles?: IUserRole[];
}

export interface CreateUserWebDto {
  idEmployee: number;
  firstName: string;
  lastName: string;
  password?: string;
  roleIds?: number;
}

export interface UpdateUserWebDto {
  employeeId?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  type?: number;
  isActive?: boolean;
  roles?: number[]; 
}

export interface ChangePasswordDto {
  newPassword: string;
}

export interface AssignRolesDto {
  roleIds: number[];
}

export interface IUserRole {
  id: number;
  name: string;
  createdAt: string | null;
}

export interface IUserWithPositionsDto {
  idEmployee: number;
  email: string;
  firstName: string;
  lastName: string;
  type: number;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  fullName: string;
  roles?: IUserRole[];
}

export interface UserPagedResult<T> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  groupCounts: any;
  items: T[];
}

export interface UserWebRow {
  id: string;
  employeeId: string;
  fullName: string;
  toggle: boolean;
  submitDate?: string | null;
  createdAt?: string | null;
  rolesText?: string;
}


// Type alias for the actual API response
export type ApiResponse = UserPagedResult<IUserWithPositionsDto>;
