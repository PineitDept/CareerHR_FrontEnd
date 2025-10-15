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
    width: '15%',
  },
  {
    header: 'Username',
    field: 'teamName',
    type: 'text',
    width: '35%',
  },
  {
    header: 'Appointment Count',
    field: 'appointmentCount',
    type: 'number',
    align: 'center',
    width: '15%'
  },
  {
    header: 'Member Count',
    field: 'memberCount',
    type: 'number',
    align: 'center',
    width: '10%'
  },
//   {
//     header: 'Location',
//     field: 'locations',
//     type: 'text',
//     align: 'center',
//     width: '15%'
//   },
  {
    header: 'Status',
    field: 'isActive',
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

export const ResponsibilitiesColumns = (): Columns => ([
  {
      header: 'No.',
      field: '__index',
      type: 'number',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Details',
      field: 'message',
      type: 'text',
      wrapText: true,
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '20%',
      textlinkActions: ['edit-inrow', 'delete']
    }
]);

export const RequirementsColumns = (): Columns => ([
  {
      header: 'No.',
      field: '__index',
      type: 'number',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Details',
      field: 'message',
      type: 'text',
      wrapText: true,
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '20%',
      textlinkActions: ['edit-inrow', 'delete']
    }
]);

export const PreferredSkillsColumn = (): Columns => ([
  {
      header: 'No.',
      field: '__index',
      type: 'number',
      align: 'center',
      width: '10%'
    },
    {
      header: 'Details',
      field: 'message',
      type: 'text',
      wrapText: true,
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '20%',
      textlinkActions: ['edit-inrow', 'delete']
    }
]);