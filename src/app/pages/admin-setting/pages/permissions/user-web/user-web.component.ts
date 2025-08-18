import {
  Component,
  ChangeDetectionStrategy,
  computed,
  Output,
  EventEmitter,
  Input,
} from '@angular/core';
import { Columns } from '../../../../../shared/interfaces/tables/column.interface';
import { FormDialogComponent } from '../../../../../shared/components/dialogs/form-dialog/form-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { BaseUserWebComponent } from '../../../../../shared/base/base-user-web.component';
import {
  ApiResponse,
  CreateUserWebDto,
  IUserFilterRequest,
  IUserWithPositionsDto,
  ScreeningRow,
  SearchForm,
  UpdateUserWebDto
} from '../../../../../interfaces/admin-setting/user-web.interface';
import { AlertDialogComponent } from '../../../../../shared/components/dialogs/alert-dialog/alert-dialog.component';
import { UserWebService } from '../../../../../services/admin-setting/user-web/user-web.service'
import { LoadingService } from '../../../../../shared/services/loading/loading.service';

const SCREENING_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'userFiterSettings',
    CLICKED_ROWS: 'userClickedRowIndexes',
    SORT_CONFIG: 'userSortConfig',
  },
} as const;

@Component({
  selector: 'app-user-web',
  templateUrl: './user-web.component.html',
  styleUrl: './user-web.component.scss'
})

export class UserWebComponent extends BaseUserWebComponent {

  @Output() toggleRequested = new EventEmitter<{ row: any; next: boolean }>();
  
  hasMoreData = true;
  currentPage = 1;
  ScreenRows: ScreeningRow[] = [];
  SearchForm!: SearchForm;

  constructor(
    private dialog: MatDialog, 
    private userWebService: UserWebService,
    private loadingService: LoadingService) {
    super();
  }
  
  readonly columns: Columns = [
    {
      header: 'No',
      field: '__index',
      type: 'number',
      align: 'center'
    },
    {
      header: 'Employee ID',
      field: 'idEmployee',
      type: 'text',
      align: 'center',
      sortable: true
    },
    {
      header: 'Username',
      field: 'fullName',
      type: 'text',
      width: '50%'
    },
    {
      header: 'Status',
      field: 'isActive',
      type: 'toggle',
      align: 'center'
    },
    {
      header: 'Last Login',
      field: 'lastLoginAt',
      type: 'dateWithTime',
      align: 'center',
      width: '15%',
      sortable: true
    },
    {
      header: 'Create Date',
      field: 'createdAt',
      type: 'dateWithTime',
      align: 'center',
      width: '15%',
      sortable: true
    },
    {
      header: 'Action',
      field: 'textlink',
      type: 'textlink',
      align: 'center',
      width: '15%',
      textlinkActions: ['edit-topopup']
    },
  ] as const;

  defaultFilterButtons = () => ([
    { label: 'Add', key: 'add', color: '#00AAFF' },
  ]);

  filterButtons = this.defaultFilterButtons();

  handleEditDialog(row: any): void {
    Promise.resolve().then(() => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.add('dimmed-overlay');
    });

    const dialogRef = this.dialog.open(FormDialogComponent, {
      width: '496px',
      panelClass: 'custom-dialog-container',
      autoFocus: false,
      disableClose: true,
      data: {
        title: 'Edit User Web',
        message: 'Employee ID',
        labelInput: ['Employee ID', 'Username', 'New Password', 'Confirm Password'],
        valInput: [row.idEmployee, row.fullName, '', ''],
        confirm: true,
        isEditMode: true,
      }
    });

    dialogRef.afterClosed().subscribe((formValues: string[] | false) => {
      const container = document.querySelector('.cdk-overlay-container');
      container?.classList.remove('dimmed-overlay');

      if (formValues && Array.isArray(formValues)) {
        const [idEmployeeStr, Username, password, confirmPassword] = formValues;
        
        const parts = Username.trim().split(/\s+/);
        const lastName = parts.pop() || '';
        const firstName = parts.join(' '); 

        const updates: Promise<any>[] = [];

        // 🔹 เช็คว่า username ถูกแก้ไข
        if (firstName !== row.firstName || lastName !== row.lastName) {
          const updatePayload: UpdateUserWebDto = { firstName, lastName };
          const update = this.userWebService.updateUserWeb(row.idEmployee, updatePayload).toPromise();
          updates.push(update);
        }

        // 🔹 เช็คว่า user เปลี่ยนรหัสผ่าน
        if (password && password.trim().length > 0) {
          const changePasswordPayload = {
            newPassword: password.trim(),
          };

          const changePassword = this.userWebService.changePassword(row.idEmployee, changePasswordPayload).toPromise();
          updates.push(changePassword);
        }

        // 🔹 รอให้ทั้ง 2 เส้นทำงานเสร็จ
        Promise.all(updates)
          .then(() => {
            this.loadUsers();
          })
          .catch((err) => {
          });
      }
    });

  }

  onFilterButtonClick(key: string) {
    switch (key) {
      case 'add':
        
        Promise.resolve().then(() => {
          const container = document.querySelector('.cdk-overlay-container');
          container?.classList.add('dimmed-overlay');
        });
    
        const dialogRef = this.dialog.open(FormDialogComponent, {
          width: '496px',
          panelClass: 'custom-dialog-container',
          autoFocus: false,
          disableClose: true,
          data: {
            title: 'Add User Web',
            message: 'Employee ID',
            labelInput: ['Employee ID', 'Username', 'Password', 'Confirm Password'],
            valInput: ["", "", "", ""],
            confirm: true,
            isEditMode: false,
          }
        });

        dialogRef.afterClosed().subscribe((formValues: string[] | false) => {
            
          const container = document.querySelector('.cdk-overlay-container');
          container?.classList.remove('dimmed-overlay');

          if (formValues && Array.isArray(formValues)) {
            const [idEmployeeStr, UserName, password, confirmPassword] = formValues;

            const parts = UserName.trim().split(/\s+/);
            const lastName = parts.pop() || '';
            const firstName = parts.join(' '); 

            const payload: CreateUserWebDto = {
              idEmployee: Number(idEmployeeStr),
              firstName,
              lastName,
              password: password.trim(),
              roleIds: 1,
            };

            this.userWebService.createUserWeb(payload).subscribe({
              next: (res) => {
                this.loadUsers();
              },
              error: (err) => {
              },
            });
          }
        });

        break;
    }
  }

  protected currentFilterParams: IUserFilterRequest = {
    page: 1,
    pageSize: 30
  };

  loadUsers() {
    this.userWebService.getUserWeb(this.currentFilterParams).subscribe({
      next: (res) => {
        this.ScreenRows = this.transformApiDataToRows(res.items);
      },
      error: (err) => console.error(err),
    });
  }

  // Abstract method implementations
  protected getStorageKeys() {
    return SCREENING_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(): IUserFilterRequest {
    return {
      page: 1,
      pageSize: 30
    };
  }

  protected transformApiDataToRows(
    items: readonly IUserWithPositionsDto[]
  ): ScreeningRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }
  
  private transformSingleItem(
    item: IUserWithPositionsDto
  ): ScreeningRow {

    return {
      idEmployee: item.idEmployee,
      email: item.email,
      firstName: item.firstName,
      lastName: item.lastName,
      type: item.type,
      activeStatus: item.isActive,
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt,
      fullName: item.fullName,
    };
  }

  onToggleChange(e: Event, row: any) {
    const next = (e.target as HTMLInputElement).checked;
    (e.target as HTMLInputElement).checked = !next;
    this.toggleRequested.emit({ row, next });
  }

  // onUserToggleRequested({ row }: { row: any }) {
  //   this.userWebService.toggleActive(row.idEmployee).subscribe({
  //     next: () => {
  //       console.log(`User ${row.idEmployee} toggle success`);
  //     },
  //     error: () => {
  //       console.error('Toggle failed');
  //     }
  //   });
  // }

  onUserToggleRequested({
    row,
    checked,
    checkbox
  }: {
    row: any;
    checked: boolean;
    checkbox: HTMLInputElement;
  }) {
    this.userWebService.toggleActive(row.idEmployee).subscribe({
      next: () => {
        checkbox.checked = checked;

        if ('isActive' in row) row.isActive = checked;
        if ('activeStatus' in row) row.activeStatus = checked;
        
      },
      error: () => {
        console.error('Toggle failed');
      }
    });
  }
}