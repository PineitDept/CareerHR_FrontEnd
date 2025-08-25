import { Columns } from "../../shared/interfaces/tables/column.interface";

export const defaultSearchForm = () => ({
  searchBy: '',
  searchValue: '',
});

export const defaultFilterButtons = () => ([
    { label: 'Add', key: 'add', color: '#00AAFF' },
]);

export const defaultFilterButtonsDetails = () => ([
    { label: 'Edit', key: 'edit', color: '#333333' },
    { label: 'Save', key: 'save', color: '#000055' },
]);

export const defaultColumns = (): Columns => ([
  {
    header: 'No.',
    field: '__index',
    type: 'number',
    align: 'center',
    width: '40px',
  },
  {
    header: 'Email Template Name',
    field: 'subject',
    type: 'text',
  },
  {
    header: 'Status',
    field: 'activeStatus',
    type: 'toggle',
    align: 'center',
    width: '10%'
  },
  {
    header: 'Action',
    field: 'textlink',
    type: 'textlink',
    align: 'center',
    width: '15%',
    textlinkActions: ['view'],
  }
]);

export const defaultColumnsAttribute = (): Columns => ([
  {
    header: 'No.',
    field: '__index',
    type: 'number',
    align: 'center',
    width: '40px',
  },
  {
    header: 'Email Attribute Name',
    field: 'subject',
    type: 'text',
  },
  {
    header: 'Status',
    field: 'activeStatus',
    type: 'toggle',
    align: 'center',
    width: '10%'
  },
  {
    header: 'Action',
    field: 'textlink',
    type: 'textlink',
    align: 'center',
    width: '15%',
    textlinkActions: ['view'],
  }
]);

export const defaultDetailsFilterButtons = () => [
  { label: 'Edit', key: 'edit', color: '#000000' },
  { label: 'Save', key: 'save', color: '#000055' },
];
