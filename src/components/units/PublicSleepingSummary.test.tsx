import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicSleepingSummary } from './PublicSleepingSummary';
import { publicSleepingLabelsForLocale } from '@/modules/content/public-sleeping';
import type { PublicSleepingSpace } from '@/modules/projects/public-sleeping';

const spaces: PublicSleepingSpace[] = [{ spaceType: 'bedroom', sortOrder: 0, beds: [{ bedType: 'double', count: 1 }] }, { spaceType: 'living_room', sortOrder: 1, beds: [{ bedType: 'single', count: 2 }] }];
describe('source-backed public sleeping summary', () => {
  it.each(['en', 'ru', 'th', 'zh'])('renders localized room types and honest double size in %s', locale => {
    const labels = publicSleepingLabelsForLocale(locale);
    render(<PublicSleepingSummary spaces={spaces} labels={labels} />);
    expect(screen.getByRole('region', { name: labels['listing.sleeping.title'] })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: `${labels['listing.sleeping.bedroom']} 1` })).toBeInTheDocument();
    expect(screen.getByText(`1 × ${labels['listing.sleeping.double']}`)).toBeInTheDocument();
    expect(screen.getByText(`2 × ${labels['listing.sleeping.single']}`)).toBeInTheDocument();
    expect(screen.queryByText(labels['listing.sleeping.king'])).toBeNull();
  });
  it.each([undefined, []])('omits the section without source facts', spaces => {
    const { container } = render(<PublicSleepingSummary spaces={spaces} labels={publicSleepingLabelsForLocale('en')} />);
    expect(container).toBeEmptyDOMElement();
  });
});
