import { StrictMode } from 'react';
import { createMapLibreFake } from '@/test/doubles/maplibre-test-double';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockMapLibre(gate: Promise<void> = Promise.resolve(), failControl = false) {
  const fake = createMapLibreFake(failControl);
  let started!: () => void;
  const importStarted = new Promise<void>((resolve) => { started = resolve; });
  vi.doMock('maplibre-gl', async () => {
    started();
    await gate;
    return { ...fake.api, default: fake.api };
  });
  return { ...fake, importStarted };
}

const projects = [{ id: 'project-1', name: 'A home', latitude: 7.9, longitude: 98.3, unitCount: 2 }];
function props() {
  return {
    projects, selectedProjectId: null, onSelectProject: vi.fn(), onBoundsChange: vi.fn(),
    labels: { loading: 'Loading map', unavailable: 'Map unavailable', homes: '{count} homes', aria: 'Search map' },
  };
}
async function finishImport() {
  await act(async () => { await vi.dynamicImportSettled(); });
}

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.doUnmock('maplibre-gl'); });

describe('SearchResultsMap lifecycle', () => {
  it('removes map, markers, listeners and pending bounds work on unmount', async () => {
    const fake = mockMapLibre();
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const input = props();
    const view = render(<SearchResultsMap {...input} />);
    await finishImport();
    const map = fake.maps[0];
    act(() => map.emit('load'));
    expect(fake.markers).toHaveLength(1);
    const marker = fake.markers[0];
    const lateLoad = [...map.listeners.get('load')!][0];
    const lateError = [...map.listeners.get('error')!][0];
    const lateMove = [...map.listeners.get('moveend')!][0];
    act(() => map.emit('moveend'));
    view.unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(marker.remove).toHaveBeenCalledTimes(1);
    expect(marker.element.onclick).toBeNull();
    expect([...map.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
    act(() => { lateLoad(); lateError(); lateMove(); vi.runAllTimers(); marker.element.click(); });
    expect(map.getBounds).not.toHaveBeenCalled();
    expect(input.onBoundsChange).not.toHaveBeenCalled();
    expect(input.onSelectProject).not.toHaveBeenCalled();
    expect(fake.markers).toHaveLength(1);
    expect(map.remove).toHaveBeenCalledTimes(1);
  });

  it('does not construct a map when its import resolves after unmount', async () => {
    let resolveImport!: () => void;
    const gate = new Promise<void>((resolve) => { resolveImport = resolve; });
    const fake = mockMapLibre(gate);
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const view = render(<SearchResultsMap {...props()} />);
    await fake.importStarted;
    view.unmount();
    resolveImport();
    await finishImport();
    expect(fake.maps).toHaveLength(0);
  });

  it('does not show a failure when a rejected import arrives after unmount', async () => {
    let rejectImport!: (error: Error) => void;
    const gate = new Promise<void>((_, reject) => { rejectImport = reject; });
    const fake = mockMapLibre(gate);
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const view = render(<SearchResultsMap {...props()} />);
    await fake.importStarted;
    view.unmount();
    rejectImport(new Error('import unavailable'));
    await finishImport();
    expect(fake.maps).toHaveLength(0);
    expect(screen.queryByText('Map unavailable')).not.toBeInTheDocument();
  });

  it('keeps one live map in StrictMode and initializes again after a real remount', async () => {
    // A manual mock uses the module cache for concurrent StrictMode imports.
    // Async factory mocks can escape to real MapLibre through Vitest's shared
    // recursion guard; gated import resolution/rejection is tested separately.
    vi.doMock('maplibre-gl');
    const fake = await import('../../../__mocks__/maplibre-gl');
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const input = props();
    const view = render(<StrictMode><SearchResultsMap {...input} /></StrictMode>);
    await finishImport();
    expect(fake.maps).toHaveLength(1);
    act(() => fake.maps[0].emit('load'));
    expect(screen.queryByText('Loading map')).not.toBeInTheDocument();
    view.unmount();
    expect(fake.maps[0].remove).toHaveBeenCalledTimes(1);
    const next = render(<SearchResultsMap {...input} />);
    expect(screen.getByText('Loading map')).toBeInTheDocument();
    await finishImport();
    expect(fake.maps).toHaveLength(2);
    act(() => fake.maps[1].emit('load'));
    expect(screen.queryByText('Loading map')).not.toBeInTheDocument();
    next.unmount();
    expect(fake.maps[1].remove).toHaveBeenCalledTimes(1);
  });

  it('uses the latest bounds callback without rebuilding the map or losing its timer', async () => {
    const fake = mockMapLibre();
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const input = props();
    const view = render(<SearchResultsMap {...input} />);
    await finishImport();
    const map = fake.maps[0];
    act(() => { map.emit('load'); map.emit('moveend'); vi.advanceTimersByTime(100); });
    const latest = vi.fn();
    view.rerender(<SearchResultsMap {...input} onBoundsChange={latest} />);
    act(() => vi.advanceTimersByTime(249));
    expect(latest).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith({
      swLat: 7.123457, swLng: 98.123457, neLat: 8.123457, neLng: 99.123457,
    });
    expect(input.onBoundsChange).not.toHaveBeenCalled();
    expect(fake.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();
  });

  it('debounces repeated moveend events and retains current marker selection', async () => {
    const fake = mockMapLibre();
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const input = props();
    render(<SearchResultsMap {...input} />);
    await finishImport();
    const map = fake.maps[0];
    act(() => map.emit('load'));
    act(() => { map.emit('moveend'); vi.advanceTimersByTime(200); map.emit('moveend'); vi.advanceTimersByTime(349); });
    expect(input.onBoundsChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); fake.markers[0].element.click(); });
    expect(input.onBoundsChange).toHaveBeenCalledTimes(1);
    expect(input.onSelectProject).toHaveBeenCalledWith('project-1');
  });

  it('disposes before showing the existing error fallback and ignores late events', async () => {
    const fake = mockMapLibre();
    const { SearchResultsMap } = await import('./SearchResultsMap');
    const input = props();
    const view = render(<SearchResultsMap {...input} />);
    await finishImport();
    const map = fake.maps[0];
    act(() => map.emit('load'));
    const lateLoad = [...map.listeners.get('load')!][0];
    const lateError = [...map.listeners.get('error')!][0];
    const lateMove = [...map.listeners.get('moveend')!][0];
    act(() => { map.emit('moveend'); map.emit('error'); });
    expect(screen.getByText('Map unavailable')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search map')).not.toBeInTheDocument();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(fake.markers[0].remove).toHaveBeenCalledTimes(1);
    act(() => { lateLoad(); lateError(); lateMove(); vi.runAllTimers(); fake.markers[0].element.click(); });
    expect(input.onBoundsChange).not.toHaveBeenCalled();
    expect(input.onSelectProject).not.toHaveBeenCalled();
    expect(map.getBounds).not.toHaveBeenCalled();
    expect(fake.markers).toHaveLength(1);
    view.unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
    expect(fake.markers[0].remove).toHaveBeenCalledTimes(1);
  });

  it('cleans up a partially initialized map if control setup throws', async () => {
    const fake = mockMapLibre(Promise.resolve(), true);
    const { SearchResultsMap } = await import('./SearchResultsMap');
    render(<SearchResultsMap {...props()} />);
    await finishImport();
    expect(screen.getByText('Map unavailable')).toBeInTheDocument();
    expect(fake.maps[0].remove).toHaveBeenCalledTimes(1);
    expect([...fake.maps[0].listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });
});
