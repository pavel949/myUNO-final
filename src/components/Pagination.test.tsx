// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  const baseProps = {
    summary: 'Showing 24 of 60',
    loadMoreLabel: 'Show more',
    loadingLabel: 'Loading…',
    onLoadMore: () => {},
  };

  it('shows the summary and a load-more button when more remain', () => {
    render(<Pagination {...baseProps} shown={24} total={60} />);
    expect(screen.getByText('Showing 24 of 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('hides the load-more button when everything is shown', () => {
    render(<Pagination {...baseProps} shown={60} total={60} summary="Showing 60 of 60" />);
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('fires onLoadMore when clicked', () => {
    const onLoadMore = vi.fn();
    render(<Pagination {...baseProps} shown={24} total={60} onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
