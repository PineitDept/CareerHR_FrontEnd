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