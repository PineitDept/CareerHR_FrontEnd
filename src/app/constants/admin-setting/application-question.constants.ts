import { Columns } from "../../shared/interfaces/tables/column.interface";

export const defaultSearchForm = () => ({
  searchBy: '',
  searchValue: '',
});

export const defaultColumns = (): Columns => ([
  {
    header: 'No.',
    field: 'no',
    type: 'text',
    align: 'center',
  },
  {
    header: 'Category Type',
    field: 'categoryType',
    type: 'text',
  },
  {
    header: 'Status',
    field: 'activeStatus',
    type: 'toggle',
    align: 'center',
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
