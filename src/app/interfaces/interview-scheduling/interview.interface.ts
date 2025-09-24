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