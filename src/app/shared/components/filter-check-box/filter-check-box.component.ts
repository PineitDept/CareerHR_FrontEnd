import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';

export interface GroupedCheckboxOption {
  groupKey: string;
  groupLabel: string;
  options: { key: string; label: string }[];
}

export interface FilterConfig {
  expandAllByDefault?: boolean;
  groupExpansionConfig?: Record<string, boolean>;
  animationDuration?: number;
}

@Component({
  selector: 'app-filter-check-box',
  templateUrl: './filter-check-box.component.html',
  styleUrl: './filter-check-box.component.scss'
})
export class FilterCheckBoxComponent implements OnInit {
  @Input() items: GroupedCheckboxOption[] = [];
  @Input() config: FilterConfig = {};
  @Output() selected = new EventEmitter<Record<string, string[]>>();

  expandedGroups = new Set<string>();
  checkedMap = new Map<string, Set<string>>();

  ngOnInit() {
    this.initializeExpansionState();
  }

  private initializeExpansionState() {
    if (this.config.expandAllByDefault) {
      this.items.forEach(item => this.expandedGroups.add(item.groupKey));
    } else if (this.config.groupExpansionConfig) {
      Object.entries(this.config.groupExpansionConfig).forEach(([groupKey, expanded]) => {
        if (expanded) {
          this.expandedGroups.add(groupKey);
        }
      });
    }
  }

  toggleGroup(groupKey: string) {
    this.expandedGroups.has(groupKey)
      ? this.expandedGroups.delete(groupKey)
      : this.expandedGroups.add(groupKey);
  }

  isExpanded(groupKey: string): boolean {
    return this.expandedGroups.has(groupKey);
  }

  isChecked(groupKey: string, key: string): boolean {
    return this.checkedMap.get(groupKey)?.has(key) ?? false;
  }

  toggleOption(groupKey: string, key: string) {
    if (!this.checkedMap.has(groupKey)) {
      this.checkedMap.set(groupKey, new Set<string>());
    }

    const set = this.checkedMap.get(groupKey)!;
    set.has(key) ? set.delete(key) : set.add(key);
    this.emitSelected();
  }

  emitSelected() {
    const result: Record<string, string[]> = {};
    for (const [group, keys] of this.checkedMap.entries()) {
      result[group] = [...keys];
    }
    this.selected.emit(result);
  }

  getCheckedCount(groupKey: string): number {
    return this.checkedMap.get(groupKey)?.size ?? 0;
  }
}