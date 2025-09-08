export interface ApiReason {
  reasonId: number | null;
  reasonText: string;
  isActive: boolean;
  isDelete: boolean;
}

export interface ApiCategory {
  categoryId: number | null;
  categoryName: string;
  categoryType: string;
  isActive: boolean;
  isUnmatch: boolean;
  reasons: ApiReason[]; // diff only
}

export interface ApiRequestBody {
  stageId: number;
  categories: ApiCategory[];
}
