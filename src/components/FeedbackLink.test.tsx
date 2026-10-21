import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const route = vi.hoisted(() => ({ path: '/', query: '' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path, useSearchParams: () => new URLSearchParams(route.query) }));
import FeedbackLink from './FeedbackLink';

describe('immediate navigation acknowledgement', () => {
  beforeEach(() => { route.path = '/'; route.query = ''; });
  it('shows feedback in the click event without waiting for the server and clears on route change', () => {
    const view = render(<FeedbackLink href="/projects/example" prefetch={false}>Open complex</FeedbackLink>);
    fireEvent.click(screen.getByRole('link'), { button: 0 });
    expect(screen.getByRole('link')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelector('[data-navigation-feedback]')).toBeInTheDocument();
    act(() => { route.path = '/projects/example'; });
    view.rerender(<FeedbackLink href="/projects/example" prefetch={false}>Open complex</FeedbackLink>);
    expect(document.querySelector('[data-navigation-feedback]')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-busy', 'true');
  });
  it('preserves the original href and click callback', () => {
    const clicked = vi.fn();
    render(<FeedbackLink href="/search?adults=2" prefetch={false} onClick={clicked}>Search</FeedbackLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/search?adults=2');
  });
  it.each([{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}])('ignores modified clicks %j', modifiers => {
    render(<FeedbackLink href="/projects/example" prefetch={false}>Open</FeedbackLink>);
    fireEvent.click(screen.getByRole('link'), modifiers);
    expect(document.querySelector('[data-navigation-feedback]')).not.toBeInTheDocument();
  });
  it.each([{href:'#details'}, {href:'https://example.org'}, {href:'/file',download:true}, {href:'/other',target:'_blank'}])('ignores native action %j', props => {
    render(<FeedbackLink {...props} prefetch={false}>Open</FeedbackLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(document.querySelector('[data-navigation-feedback]')).not.toBeInTheDocument();
  });
  it('respects cancelled navigation', () => {
    render(<FeedbackLink href="/projects/example" prefetch={false} onClick={event => event.preventDefault()}>Open</FeedbackLink>);
    fireEvent.click(screen.getByRole('link'));
    expect(document.querySelector('[data-navigation-feedback]')).not.toBeInTheDocument();
  });
  it('cleans up its indicator on unmount', () => {
    const view=render(<FeedbackLink href="/other" prefetch={false}>Open</FeedbackLink>);
    fireEvent.click(screen.getByRole('link'));
    view.unmount();
    expect(document.querySelector('[data-navigation-feedback]')).not.toBeInTheDocument();
  });
});

it('clears pending for a query-only route transition', () => {
  const view = render(<FeedbackLink href="/?intent=buy" prefetch={false}>Buy</FeedbackLink>);
  fireEvent.click(screen.getByRole('link'));
  expect(document.querySelector('[data-navigation-feedback]')).toBeInTheDocument();
  route.query = 'intent=buy';
  view.rerender(<FeedbackLink href="/?intent=buy" prefetch={false}>Buy</FeedbackLink>);
  expect(document.querySelector('[data-navigation-feedback]')).not.toBeInTheDocument();
});
