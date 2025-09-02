export interface InterviewerDetails {
    // teamId: number;
    teamName: string;
    isActive: boolean;
    members?: any;
    appointmentCount?: number;
}

export interface DropdownOverlay {
    visible: boolean;
    rowIndex: number | null;
    field: string;
    x: number;
    y: number;
    width: number;
    options: string[];
}