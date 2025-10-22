import { IconConfig } from './application.interface';

export interface CandidateTrackStatus {
  id?: number;
  status?: string;
  date?: string; // ใช้ string เพื่อรองรับ DateTime ISO จาก API
}

export interface Positions {
  iDjobPST?: number;
  namePosition?: string;
}

export interface CandidateTracking {
  userID: number;
  roundID?: number;
  fullName: string;
  fullNameTH: string;
  gradeCandidate: string;
  countLike?: number;
  submitDate?: string;
  email?: string;
  phoneNumber?: string;
  gpa?: number;
  university: string;
  uniID?: number;
  faculty?: string;
  major?: string;
  statusCSD: number;
  applied: CandidateTrackStatus;
  screened: CandidateTrackStatus;
  interview1: CandidateTrackStatus;
  interview2: CandidateTrackStatus;
  offer: CandidateTrackStatus;
  hired: CandidateTrackStatus;
  lastUpdate?: string;
  positions?: Positions[];
  groupCounts?: any;
}

export interface TrackingRow {
  id:string;
  submitDate?: string;
  userID: string;
  fullName: string;
  fullNameTH: string;
  gradeCandidate: string;
  gpa?: number;
  university: string;
  uniID?: number;
  position: string[];
  applied: IconConfig;
  statusCSD: IconConfig;
  interview1: IconConfig;
  interview2: IconConfig;
  offer: IconConfig;
  hired: IconConfig;
  lastUpdate?: string;
  roundID?: number;
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
