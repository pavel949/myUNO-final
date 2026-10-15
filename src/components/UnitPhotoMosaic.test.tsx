import { beforeEach, describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { UnitPhotoMosaic } from './UnitPhotoMosaic';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
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

  it('offers full-screen viewing for larger galleries', () => {
    render(<UnitPhotoMosaic images={photos(9)} alt="Villa" showAllLabel="Show all" />);
    expect(screen.getByRole('button', { name: 'Show all' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('offers full-screen viewing even for small galleries', () => {
    render(<UnitPhotoMosaic images={photos(5)} alt="Villa" showAllLabel="Show all" />);
    expect(screen.getByRole('button', { name: 'Show all' })).toHaveAttribute('aria-haspopup', 'dialog');
  });
});

describe('a home with no published photos', () => {
  it('says so instead of rendering a blank block', () => {
    render(<UnitPhotoMosaic images={[]} alt="Villa" showAllLabel="Show all" emptyLabel="Photos are being prepared." />);
    expect(screen.getByRole('img', { name: 'Photos are being prepared.' })).toBeTruthy();
    expect(screen.getByText('Photos are being prepared.')).toBeTruthy();
  });
});


describe('shared property gallery composition', () => {
  it.each([1, 2, 3, 4, 5])('adapts its desktop layout to %i real images', (count) => {
    const { container } = render(<UnitPhotoMosaic images={photos(count)} alt="Residence" showAllLabel="View photos" />);
    const mosaic = container.querySelector('.md\\:grid')!;
    expect(mosaic.children).toHaveLength(count);
    expect(mosaic).toHaveClass(count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-2' : 'grid-cols-4');
    expect(mosaic).toHaveClass('overflow-hidden', 'rounded-lg');
  });

  it('makes the native mobile carousel keyboard reachable', () => {
    render(<UnitPhotoMosaic images={photos(3)} alt="Residence" showAllLabel="View photos" />);
    expect(screen.getByRole('region', { name: 'Residence' })).toHaveAttribute('tabindex', '0');
  });

  it('opens every photo in a modal with keyboard, swipe, Escape and focus return', () => {
    render(<UnitPhotoMosaic images={photos(7)} alt="Residence" showAllLabel="View photos" />);
    const button = screen.getByRole('button', { name: 'View photos' });
    button.focus();
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('status')).toHaveTextContent('1 / 7');
    const close = within(dialog).getByRole('button', { name: 'Close gallery' });
    const next = within(dialog).getByRole('button', { name: 'Next photo' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(within(dialog).getByRole('status')).toHaveTextContent('7 / 7');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('1 / 7');
    const image = within(dialog).getByAltText('Residence (1/7)');
    fireEvent.touchStart(image.parentElement!, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(image.parentElement!, { changedTouches: [{ clientX: 80 }] });
    expect(within(dialog).getByRole('status')).toHaveTextContent('2 / 7');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('opens the selected photo directly and handles failed image delivery', () => {
    render(<UnitPhotoMosaic images={photos(3)} alt="Residence" showAllLabel="View photos" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View photos: 3 / 3' })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('status')).toHaveTextContent('3 / 3');
    fireEvent.error(within(dialog).getByAltText('Residence (3/3)'));
    expect(within(dialog).getByRole('img', { name: 'This photo could not be loaded.' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Previous photo' }));
    expect(within(dialog).getByAltText('Residence (2/3)')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close gallery' }));
  });
});
