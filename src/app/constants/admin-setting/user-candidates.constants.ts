import { IconConfig } from "../../interfaces/admin-setting/user-candidates.interface";
import { Columns } from "../../shared/interfaces/tables/column.interface";

export const defaultSearchForm = () => ({
  searchBy: '',
  searchValue: '',
});

export const defaultSearchByOptions = () => ['UserID', 'UserName', 'Email', 'PhoneNumber'];

export const defaultFilterButtons = () => [
  { label: 'Export Excel', key: 'export', color: '#005500' },
];

export const defaultColumns = (): Columns => ([
  {
    header: 'User ID',
    field: 'userID',
    type: 'text',
    sortable: true,
    align: 'center',
  },
  {
    header: 'User Name',
    field: 'userName',
    type: 'text',
    sortable: true,
  },
  {
    header: 'Email',
    field: 'email',
    type: 'text',
    sortable: true,
  },
  {
    header: 'Phone Number',
    field: 'phoneNumber',
    type: 'text',
    sortable: true,
    align: 'center',
  },
  {
    header: 'Created Date',
    field: 'createDate',
    type: 'dateWithTime',
    sortable: true,
    align: 'center',
  },
  {
    header: 'Last Login',
    field: 'lastLogin',
    type: 'dateWithTime',
    sortable: true,
    align: 'center',
  },
  {
    header: 'Information',
    field: 'informationCompleted',
    type: 'icon'
  },
  {
    header: 'Quiz',
    field: 'quizCompleted',
    type: 'icon'
  },
  {
    header: 'Apply Submit',
    field: 'sendFormCompleted',
    type: 'icon'
  },
]);

export function createStatusIcon(status: number): IconConfig {
  return status === 1
    ? { icon: 'check-circle', fill: 'green', size: '25' }
    : { icon: 'xmark-circle', fill: 'red', size: '25' };
}
