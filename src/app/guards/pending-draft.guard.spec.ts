import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { PendingDraftsGuard, PendingDraftsAware } from './pending-draft.guard';

describe('PendingDraftsGuard (class-based)', () => {
  let guard: PendingDraftsGuard;
  let dialogSpy: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    /**
     * Create a MatDialog spy so we can:
     * - Assert whether `open()` was called or not
     * - Control the value emitted by `afterClosed()`
     */
    dialogSpy = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    TestBed.configureTestingModule({
      providers: [
        PendingDraftsGuard,
        // Provide the spy instead of a real MatDialog
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    guard = TestBed.inject(PendingDraftsGuard);
  });

  // Minimal helper to mock RouterStateSnapshot
  const makeState = (url: string) => ({ url } as unknown as RouterStateSnapshot);

  // Create a fresh mock for each test to avoid cross-test contamination
  const makeAware = (overrides?: Partial<PendingDraftsAware>): PendingDraftsAware => ({
    hasFormChanged: () => false,
    hasPendingDrafts: () => false,
    clearDraftsForCurrentType: () => {},
    ...overrides,
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('returns true immediately when there are no changes (no dialog shown)', () => {
    // Arrange: no changes
    const component = makeAware({
      hasFormChanged: () => false,
      hasPendingDrafts: () => false,
    });
    const currentRoute = {} as ActivatedRouteSnapshot;
    const currentState = makeState('/current');
    const nextState = makeState('/next');

    // Act
    const result = guard.canDeactivate(component);

    // Assert
    expect(result).toBeTrue();
    expect(dialogSpy.open).not.toHaveBeenCalled(); // Dialog should not be opened
  });

  it('when user chooses "discard", returns true and clears drafts', (done) => {
    // Arrange: there are changes (either form changed or pending drafts)
    const clearSpy = jasmine.createSpy('clearDraftsForCurrentType');
    const component = makeAware({
      hasFormChanged: () => true,
      hasPendingDrafts: () => false,
      clearDraftsForCurrentType: clearSpy,
    });
    dialogSpy.open.and.returnValue({
      // Simulate user clicking the "discard" choice in the dialog
      afterClosed: () => of<'discard'>('discard'),
    } as any);

    // Act
    const result = guard.canDeactivate(component);

    // Assert
    expect(dialogSpy.open).toHaveBeenCalled();
    // Since there are changes, the guard returns an Observable<boolean>
    if (typeof result === 'boolean') {
      fail('Expected an Observable<boolean> when there are changes');
      return;
    }
    result.subscribe((ok) => {
      expect(ok).toBeTrue(); // navigation allowed
      expect(clearSpy).toHaveBeenCalledTimes(1); // drafts should be cleared
      done();
    });
  });

  it('when user chooses "keep", returns true (do not clear drafts)', (done) => {
    const clearSpy = jasmine.createSpy('clearDraftsForCurrentType');
    const component = makeAware({
      hasFormChanged: () => false,
      hasPendingDrafts: () => true,
      clearDraftsForCurrentType: clearSpy,
    });
    dialogSpy.open.and.returnValue({
      // Simulate user clicking the "keep" choice
      afterClosed: () => of<'keep'>('keep'),
    } as any);

    const result = guard.canDeactivate(component);

    expect(dialogSpy.open).toHaveBeenCalled();
    if (typeof result === 'boolean') {
      fail('Expected an Observable<boolean> when there are changes');
      return;
    }
    result.subscribe((ok) => {
      expect(ok).toBeTrue(); // navigation allowed
      expect(clearSpy).not.toHaveBeenCalled(); // keep drafts as-is
      done();
    });
  });

  it('when user chooses "stay", returns false (navigation cancelled)', (done) => {
    const clearSpy = jasmine.createSpy('clearDraftsForCurrentType');
    const component = makeAware({
      hasFormChanged: () => true,
      hasPendingDrafts: () => true,
      clearDraftsForCurrentType: clearSpy,
    });
    dialogSpy.open.and.returnValue({
      // Simulate user clicking "stay"
      afterClosed: () => of<'stay'>('stay'),
    } as any);

    const result = guard.canDeactivate(component);

    expect(dialogSpy.open).toHaveBeenCalled();
    if (typeof result === 'boolean') {
      fail('Expected an Observable<boolean> when there are changes');
      return;
    }
    result.subscribe((ok) => {
      expect(ok).toBeFalse(); // navigation cancelled
      expect(clearSpy).not.toHaveBeenCalled(); // no clearing when staying
      done();
    });
  });
});
