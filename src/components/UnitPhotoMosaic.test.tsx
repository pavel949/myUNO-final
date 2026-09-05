import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitPhotoMosaic } from './UnitPhotoMosaic';

describe('UnitPhotoMosaic', () => {
  it('expands remaining photos from the content-layer label', async () => {
    render(
      <UnitPhotoMosaic
        alt="Villa"
        showAllLabel="Show all 6 photos"
        images={['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg', '/f.jpg']}
      />
    );
    const before = screen.getAllByAltText('Villa').length;
    await userEvent.click(screen.getByRole('button', { name: 'Show all 6 photos' }));
    expect(screen.getAllByAltText('Villa').length).toBeGreaterThan(before);
  });
});
