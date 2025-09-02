import { MenuItem } from "../../interfaces/menu/menu.interface";

export const MAIN_MENU: MenuItem[] = [
    { label: 'Manpower', icon: 'user', path: 'manpower' },
    { label: 'Applications Form', icon: 'hand-taking-user', path: 'applications' },
    { label: 'Interview Scheduling', icon: 'calendar-days', path: 'interview-scheduling' },
];

export const BOTTOM_MENU: MenuItem[] = [
    { label: 'Admin Setting', icon: 'gear' },
    { label: 'Logout', icon: 'exit' },
];

export const SUB_MENUS: Partial<Record<string, MenuItem[]>> = {
    'Manpower': [
        { label: 'Position Request', icon: 'pen-to-square', path: 'manpower/position-request' },
        { label: 'Manpower Planning', icon: 'ruler-pen', path: 'manpower/manpower-planning' },
        { label: 'Status Overview', icon: 'trend-up', path: 'manpower/status-overview' },
    ],
    'Applications Form': [
        { label: 'All Applications', icon: 'notebook', path: 'applications/all-applications' },
        { label: 'Application Screening', icon: 'search-plus', path: 'applications/screening' },
        { label: 'Application Tracking', icon: 'route', path: 'applications/tracking' },
    ],
    'Interview Scheduling': [
        { label: 'Appointment List', icon: 'pen-to-square', path: 'interview-scheduling/appointment-list' },
        { label: 'Interview Round 1', icon: 'pen-to-square', path: 'interview-scheduling/interview-round-1' },
        { label: 'Interview Round 2', icon: 'pen-to-square', path: 'interview-scheduling/interview-round-2' },
    ],
    'Admin Setting': [
        {
            label: 'Permissions',
            icon: 'shield',
            children: [
                { label: 'User Candidates', icon: 'star-fat', path: 'admin-setting/permissions/user-candidates' },
                { label: 'User Web', icon: 'user-multiple', path: 'admin-setting/permissions/user-web' },
                { label: 'Management User', icon: 'crown', path: 'admin-setting/permissions/management-user' },
            ]
        },
        {
            label: 'Data Setting',
            icon: 'sliders-horizontal-square',
            children: [
                {
                    label: 'Manpower',
                    icon: 'user',
                    children: [
                        { label: 'Job Position', icon: 'target-user', path: 'admin-setting/data-setting/manpower/job-position' },
                        { label: 'Reason Request', icon: 'pen-to-square', path: 'admin-setting/data-setting/manpower/reason-request' },
                    ]
                },
                {
                    label: 'Application',
                    icon: 'hand-taking-user',
                    children: [
                        { label: 'Web Policy', icon: 'bookmark', path: 'admin-setting/data-setting/application/web-policy' },
                        { label: 'General Benefits', icon: 'star-fat-half', path: 'admin-setting/data-setting/application/general-benefits' },
                        { label: 'Special Benefits', icon: 'badge-decagram-percent', path: 'admin-setting/data-setting/application/special-benefits' },
                        { label: 'University', icon: 'graduation-cap', path: 'admin-setting/data-setting/application/university' },
                        { label: 'Computer Skills', icon: 'code', path: 'admin-setting/data-setting/application/computer-skills' },
                        { label: 'Language Skills', icon: 'bulb', path: 'admin-setting/data-setting/application/language-skills' },
                        { label: 'Reason', icon: 'menu-cheesburger', path: 'admin-setting/data-setting/application/reason' },
                        { label: 'Application Question', icon: 'file-question', path: 'admin-setting/data-setting/application/application-question' },
                        {
                            label: 'Email',
                            icon: 'mail',
                            children: [
                                { label: 'Email Template', icon: 'text-paragraph', path: 'admin-setting/data-setting/application/email/email-template' },
                                { label: 'Email Attribute', icon: 'clipboard', path: 'admin-setting/data-setting/application/email/email-attribute' }
                            ]
                        },
                        { label: 'Score', icon: 'bar-chart', path: 'admin-setting/data-setting/application/score' },
                    ]
                },
                {
                    label: 'Interviewer',
                    icon: 'user-multiple',
                    children: [
                        { label: 'Interviewer List', icon: 'refresh-user', path: 'admin-setting/data-setting/interviewer/interviewer-list' },
                        { label: 'Interviewer Teams', icon: 'shield-check', path: 'admin-setting/data-setting/interviewer/interviewer-teams' },
                    ]
                },
            ]
        }
    ],
};
