import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ApplicationQuestionDetailsComponent } from '../pages/admin-setting/pages/data-setting/application/application-question/pages/application-question-details/application-question-details.component';
import { ConfirmLeaveDialogComponent } from '../shared/components/dialogs/confirm-leave-dialog/confirm-leave-dialog.component';

export type LeaveChoice = 'stay' | 'discard' | 'keep';

export interface PendingDraftsAware {
  hasFormChanged(): boolean;
  hasPendingDrafts(): boolean;
  clearDraftsForCurrentType(): void;
}

@Injectable({ providedIn: 'root' })
export class PendingDraftsGuard implements CanDeactivate<PendingDraftsAware> {
  constructor(private dialog: MatDialog) {}

  canDeactivate(component: PendingDraftsAware): Observable<boolean> | boolean {
    const hasChanges = !!(component.hasFormChanged?.() || component.hasPendingDrafts?.());
    if (!hasChanges) return true;

    const ref = this.dialog.open<ConfirmLeaveDialogComponent, any, LeaveChoice>(
      ConfirmLeaveDialogComponent,
      {
        width: '480px',
        panelClass: ['custom-dialog-container', 'pp-rounded-dialog'],
        data: {
          title: 'You have unsaved changes',
          message: 'Do you want to leave this page?'
        }
      }
    );

    return ref.afterClosed().pipe(
      map(choice => {
        if (choice === 'discard') {
          component.clearDraftsForCurrentType?.();
          return true;
        }
        if (choice === 'keep') return true; // ออกไปแต่เก็บ draft ไว้
        return false; // stay
      })
    );
  }
}
