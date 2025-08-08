// all-application.component.ts
import {
  Component,
  ChangeDetectionStrategy,
} from '@angular/core';

import { BaseApplicationComponent } from '../../../shared/base/base-application.component';
import {
  ApplicationRow,
  ICandidateFilterRequest,
  ICandidateWithPositionsDto,
  IPositionDto,
  TabMenu,
} from '../../../interfaces/Application/application.interface';
import { Columns } from '../../../shared/interfaces/tables/column.interface';
import { createQualifiedIcon, createStatusBadge } from '../../../utils/application/badge-utils';


// Component-specific Configuration
const ALL_APPLICATION_CONFIG = {
  STORAGE_KEYS: {
    FILTER_SETTINGS: 'candidateFilterSettings',
    CLICKED_ROWS: 'candidateclickedRowIndexes',
    SORT_CONFIG: 'candidateSortConfig',
  },
  DEFAULT_STATUS: 'pending',
} as const;

@Component({
  selector: 'app-all-application',
  templateUrl: './all-application.component.html',
  styleUrl: './all-application.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllApplicationComponent extends BaseApplicationComponent {

  // Table Configuration
  readonly columns: Columns = [
    {
      header: 'Qualified',
      field: 'qualifield',
      type: 'icon',
      align: 'center',
      minWidth: '30px',
      sortable: true,
    },
    {
      header: 'Submit Date',
      field: 'submitDate',
      type: 'date',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Applicant ID',
      field: 'userID',
      type: 'text',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Applicant Name',
      field: 'fullName',
      type: 'text',
      sortable: true,
    },
    {
      header: 'Job Position',
      field: 'position',
      type: 'list',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true,
    },
    {
      header: 'University',
      field: 'university',
      type: 'text',
      // maxWidth: '400px',
      minWidth: '264px',
      width: '16%',
      wrapText: true,
      sortable: true,
    },
    {
      header: 'GPA',
      field: 'gpa',
      type: 'text',
      align: 'center',
      sortable: true,
    },
    {
      header: 'Grade',
      field: 'gradeCandidate',
      type: 'text',
      align: 'center',
      maxWidth: '20px',
      sortable: true,
    },
    {
      header: 'Total Score',
      field: 'totalCandidatePoint',
      type: 'expandable',
      align: 'right',
      mainColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Education (1 Point)',
      field: 'bdPoint',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'GPA (1 Point)',
      field: 'gpaScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Test EQ (1 Point)',
      field: 'eqScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Test Ethics (1 Point)',
      field: 'ethicsScore',
      type: 'text',
      align: 'right',
      subColumn: 'totalCandidatePoint',
      sortable: true,
    },
    {
      header: 'Bonus',
      field: 'totalBonus',
      type: 'text',
      align: 'right',
      sortable: true,
    },
    {
      header: 'Status',
      field: 'submitStatusLabel',
      type: 'badge',
      align: 'center',
    },
  ] as const;

  // Abstract method implementations
  protected getStorageKeys() {
    return ALL_APPLICATION_CONFIG.STORAGE_KEYS;
  }

  protected createInitialFilter(): ICandidateFilterRequest {
    return {
      page: 1,
      pageSize: 30,
      status: ALL_APPLICATION_CONFIG.DEFAULT_STATUS,
    };
  }

  protected createInitialTabs(): TabMenu[] {
    return [
      { key: 'total', label: 'All Applications', count: 0 },
      { key: 'new', label: 'New Applications', count: 0 },
      { key: 'over3', label: 'Over 3 Days', count: 0 },
      { key: 'overweek', label: 'Over 1 Week', count: 0 },
      { key: 'overmonth', label: 'Over 1 Month', count: 0 },
    ];
  }

  protected transformApiDataToRows(
    items: readonly ICandidateWithPositionsDto[]
  ): ApplicationRow[] {
    return items.map((item) => this.transformSingleItem(item));
  }

  private transformSingleItem(
    item: ICandidateWithPositionsDto
  ): ApplicationRow {
    const summary = item.summary;

    return {
      id: summary.userID.toString(),
      qualifield: createQualifiedIcon(summary.qualifield),
      submitDate: summary.submitDate || '',
      userID: summary.userID.toString(),
      fullName: summary.fullName,
      position:
        item.positions?.map((pos: IPositionDto) => pos.namePosition) || [],
      university: summary.university,
      gpa: summary.gpa?.toString() || '',
      gradeCandidate: summary.gradeCandidate,
      totalCandidatePoint: `${summary.totalCandidatePoint}/4`,
      bdPoint: summary.bdPoint,
      gpaScore: summary.gpaScore,
      eqScore: summary.eqScore,
      ethicsScore: summary.ethicsScore,
      totalBonus: summary.totalBonus,
      submitStatusLabel: createStatusBadge(summary.submitStatusLabel),
    };
  }
}