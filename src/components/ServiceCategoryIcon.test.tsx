// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ServiceCategoryIcon,
  SERVICE_CATEGORY_ICON_NAMES,
} from './ServiceCategoryIcon';

// The default catalog.service_categories entries name these icons — the set
// must stay drawable or the super-app grid silently degrades to fallbacks.
const CATALOG_ICON_NAMES = [
  'car',
  'broom',
  'chef',
  'map',
  'ship',
  'flower',
  'droplet',
  'shirt',
  'children',
  'spa',
  'wrench',
  'plus',
];

describe('ServiceCategoryIcon', () => {
  it('has a drawing for every icon named in the default catalog', () => {
    for (const name of CATALOG_ICON_NAMES) {
      expect(SERVICE_CATEGORY_ICON_NAMES).toContain(name);
    }
  });

  it('renders an svg for a known icon', () => {
    const { container } = render(<ServiceCategoryIcon name="car" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('stroke')).toBe('currentColor');
  });

  it('falls back gracefully for an unknown icon name', () => {
    const { container } = render(<ServiceCategoryIcon name="hoverboard" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
