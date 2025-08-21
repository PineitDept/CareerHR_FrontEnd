import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }  from '@angular/material/input';

import { HeaderContentComponent } from './components/headers/header-content/header-content.component';
import { HeaderMainComponent } from './components/headers/header-main/header-main.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { IconComponent } from './components/icon/icon.component';
import { FilterComponent } from './components/filter/filter.component';
import { TabMenusComponent } from './components/tab-menus/tab-menus.component';
import { TablesComponent } from './components/tables/tables.component';
import { FormsModule } from '@angular/forms';
import { AlertDialogComponent } from './components/dialogs/alert-dialog/alert-dialog.component';
import { LoadingComponent } from './components/loading/loading.component';
import { MultiSelectDropdownComponent } from './components/multi-select-dropdown/multi-select-dropdown.component';
import { FilterCheckBoxComponent } from './components/filter-check-box/filter-check-box.component';
import { FormDialogComponent } from './components/dialogs/form-dialog/form-dialog.component';
import { CaptchaDialogComponent } from './components/dialogs/captcha-dialog/captcha-dialog.component';
// import { PurchaseOrderDetailsFormComponent } from './components/forms/purchase-order-details-form/purchase-order-details-form.component';

@NgModule({
  declarations: [
    HeaderContentComponent,
    HeaderMainComponent,
    SidebarComponent,
    IconComponent,
    FilterComponent,
    TabMenusComponent,
    TablesComponent,
    AlertDialogComponent,
    LoadingComponent,
    MultiSelectDropdownComponent,
    FilterCheckBoxComponent,
    FormDialogComponent,
    CaptchaDialogComponent,
    // PurchaseOrderDetailsFormComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  exports: [
    HeaderContentComponent,
    HeaderMainComponent,
    SidebarComponent,
    IconComponent,
    FilterComponent,
    TabMenusComponent,
    TablesComponent,
    AlertDialogComponent,
    LoadingComponent,
    MultiSelectDropdownComponent,
    FilterCheckBoxComponent,
    FormDialogComponent,
    CaptchaDialogComponent,
    // PurchaseOrderDetailsFormComponent
  ]
})
export class SharedModule { }
