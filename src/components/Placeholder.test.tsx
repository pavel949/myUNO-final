import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Placeholder } from './Placeholder';

// @vitest-environment jsdom
describe('Component: Placeholder', () => {
  it('should render with message', () => {
    render(React.createElement(Placeholder, { message: 'Test message' }));
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });
});
