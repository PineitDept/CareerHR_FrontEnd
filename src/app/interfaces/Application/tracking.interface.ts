export interface CandidateTrackStatus {
  id?: number;
  status?: string;
  date?: string; // ใช้ string เพื่อรองรับ DateTime ISO จาก API
}

export interface CandidateTracking {
  userID: number;
  fullName: string;
  fullNameTH: string;
  gradeCandidate: string;
  submitDate?: string;
  gpa?: number;
  university: string;
  uniID?: number;
  statusCSD: number;
  interview1: CandidateTrackStatus;
  interview2: CandidateTrackStatus;
  offer: CandidateTrackStatus;
  hired: CandidateTrackStatus;
  lastUpdate?: string;
}

export interface ICandidateFilterRequest {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  statusGroup?: string;
  grade?: string;
  universityId?: number;
  year?: number;
  month?: number;
  position?: string;
}