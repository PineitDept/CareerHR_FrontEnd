import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }  from '@angular/material/input';

import { DragDropModule } from '@angular/cdk/drag-drop';

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
import { ConfirmLeaveDialogComponent } from './components/dialogs/confirm-leave-dialog/confirm-leave-dialog.component';
import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ConfirmChangesDialogComponent } from './components/dialogs/confirm-changes-dialog/confirm-changes-dialog.component';
import { DualListboxComponent } from './components/dual-listbox/dual-listbox.component';
import { QualityDialogComponent } from './components/dialogs/quality-dialog/quality-dialog.component';
import { CdkDropdownComponent } from './components/cdk-dropdown/cdk-dropdown.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarComponent } from './components/calendar/calendar.component';

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
    ConfirmLeaveDialogComponent,
    ConfirmChangesDialogComponent,
    DualListboxComponent,
    QualityDialogComponent,
    CdkDropdownComponent,
    CalendarComponent,
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
    DragDropModule,
    OverlayModule,
    PortalModule,
    ScrollingModule,
    FullCalendarModule
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
    ConfirmLeaveDialogComponent,
    ConfirmChangesDialogComponent,
    DualListboxComponent,
    OverlayModule,
    CdkDropdownComponent,
    // PurchaseOrderDetailsFormComponent
    CalendarComponent,
    FullCalendarModule
  ]
})
export class SharedModule { }
