import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UnitPhotoMosaic } from './UnitPhotoMosaic';

const photos = (n: number) => Array.from({ length: n }, (_, i) => `/p${i + 1}.jpg`);

/**
 * The mobile half used to render the cover alone, with a decorative "1 / N"
 * badge, and offered a "show all" button only when there were MORE than five
 * images. So a unit with two to five photos showed a mobile guest exactly one
 * picture, with no way to reach the others — on the surface most guests use.
 */
describe('every photo is reachable on mobile (T-062)', () => {
  it.each([2, 3, 5, 9])('renders all %i photos in the mobile track', (count) => {
    render(<UnitPhotoMosaic images={photos(count)} alt="Villa" showAllLabel="Show all" />);
    // The mobile carousel labels each slide with its position, which is also
    // what makes the set countable here regardless of the desktop mosaic.
    for (let i = 1; i <= count; i += 1) {
      expect(screen.getByAltText(`Villa (${i}/${count})`)).toBeInTheDocument();
    }
  });

  it('shows a position counter that is announced, not merely drawn', () => {
    render(<UnitPhotoMosaic images={photos(4)} alt="Villa" showAllLabel="Show all" />);
    const counter = screen.getByText('1 / 4');
    expect(counter).toHaveAttribute('aria-live', 'polite');
  });

  it('omits the counter for a single photo, which has no position to report', () => {
    render(<UnitPhotoMosaic images={photos(1)} alt="Villa" showAllLabel="Show all" />);
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
  });

  it('falls back to a placeholder rather than breaking when there are no photos', () => {
    const { container } = render(
      <UnitPhotoMosaic images={[]} alt="Villa" showAllLabel="Show all" />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toBeTruthy();
  });

  it('still offers the desktop overflow grid past five photos', () => {
    render(<UnitPhotoMosaic images={photos(9)} alt="Villa" showAllLabel="Show all" />);
    expect(screen.getByRole('button', { name: 'Show all' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('does not offer "show all" at five or fewer, where it would reveal nothing', () => {
    render(<UnitPhotoMosaic images={photos(5)} alt="Villa" showAllLabel="Show all" />);
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });
});
