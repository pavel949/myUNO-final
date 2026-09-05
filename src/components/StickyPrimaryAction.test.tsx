import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StickyPrimaryAction } from './StickyPrimaryAction';

type ObserverCallback = (entries: Array<{ boundingClientRect: { top: number } }>) => void;

let capturedCallback: ObserverCallback | null = null;
const observe = vi.fn();
const disconnect = vi.fn();

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    capturedCallback = callback;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
}

beforeEach(() => {
  capturedCallback = null;
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StickyPrimaryAction', () => {
  it('renders children inline and observes the sentinel', () => {
    render(
      <StickyPrimaryAction>
        <button type="button">Book my own stay</button>
      </StickyPrimaryAction>
    );
    expect(screen.getAllByRole('button', { name: 'Book my own stay' })).toHaveLength(1);
    expect(observe).toHaveBeenCalledOnce();
  });

  it('adds a pinned duplicate once the sentinel scrolls above the viewport', () => {
    render(
      <StickyPrimaryAction>
        <button type="button">Book my own stay</button>
      </StickyPrimaryAction>
    );
    act(() => capturedCallback?.([{ boundingClientRect: { top: -40 } }]));
    expect(screen.getAllByRole('button', { name: 'Book my own stay' })).toHaveLength(2);
  });

  it('removes the pinned duplicate once scrolled back to the sentinel', () => {
    render(
      <StickyPrimaryAction>
        <button type="button">Book my own stay</button>
      </StickyPrimaryAction>
    );
    act(() => capturedCallback?.([{ boundingClientRect: { top: -40 } }]));
    expect(screen.getAllByRole('button', { name: 'Book my own stay' })).toHaveLength(2);
    act(() => capturedCallback?.([{ boundingClientRect: { top: 40 } }]));
    expect(screen.getAllByRole('button', { name: 'Book my own stay' })).toHaveLength(1);
  });
});
