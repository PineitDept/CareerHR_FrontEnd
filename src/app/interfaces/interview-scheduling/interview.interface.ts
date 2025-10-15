export interface DateRange {
  month: string;
  year: string;
}

export interface SearchForm {
  readonly searchBy: string;
  readonly searchValue: string;
}

export interface AppointmentEvent {
  interview: number;
  teamId: number | undefined; // แก้จาก | null เป็น | undefined
  teamName: string | null;
  date: string;
  time: string;
  userId: number;
  userName: string;
  status: string;
}

export interface IAppointmentFilterRequest {
  search?: string;
  positionId?: number;
  month?: number;
  year?: number;
  interviewDate?: string;
  InterviewResult?: string;
  sortFields?: string;
  page?: number;
  pageSize?: number;
}

export interface EmailAttachment {
  fileName: string;
  content: string;
  contentType: string;
}

export interface SendEmailRequest {
  appointmentId: string
  fromEmail: string;
  fromName: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml: boolean;
  attachments?: EmailAttachment[];
  priority?: number;
}

export interface SendReviewInterview {
  applicationId: number,
  stageId: number,
  roundID: number,
  categoryId: number,
  isSummary: boolean,
  stageDate: any,
  appointmentId: string,
  satisfaction: number | null,
  notes: string,
  strength: string,
  concern: string,
  selectedReasonIds: any[]
}

export interface UpdateCandidateStageHistoryPayload {
  categoryId: number;
  stageDate: string;
  notes?: string;
  strength?: string;
  concern?: string;
  selectedReasonIds: number[];
}

export interface GetCompanyUserInfoReq { userId: number, companyId: number }
export interface UpdateDepartmentReq { userId: number, departmentId: number }
export interface UpdateDivisionReq { userId: number, divisionId: number }
export interface UpdateLevelReq { userId: number, levelId: string }
export interface UpdatePositionReq { userId: number, positionNameTh: string, positionNameEn: string }
export interface UpdateSelectedPositionReq { userId: number; selectedPositionId: number; }
export interface UpdateProbationReq { userId: number; probationDay: number; }
export interface UpdateManagerReq { userId: number; managerId: number; }