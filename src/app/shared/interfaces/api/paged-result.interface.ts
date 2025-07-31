export interface PagedResult<T> {
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  items: T[];
}

export interface StatusGroupCount {
  new?: number;
  over3?: number;
  overweek?: number;
  overmonth?: number;
  [key: string]: number | undefined; 
}

export interface StatusGroupCounts{
  pending?: number;
  accept?: number;
  decline?: number;
  hold?: number;
  [key: string]: number | undefined;
}


// รวมทั้งสอง
export interface CandidatePagedResult<T> extends PagedResult<T> {
  statusGroupCount: StatusGroupCount;
  statusCounts: StatusGroupCounts;
}
