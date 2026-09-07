import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select } from './Select';

/**
 * Doc 06 §5: "form errors announced (aria-live)".
 *
 * Every field primitive routes its error through `FieldMessage`, which used to
 * render a plain `<p>` — visible, and completely silent to a screen reader. One
 * omission made validation failure invisible to assistive technology across
 * essentially every form in the product.
 */
describe('form errors reach assistive technology (T-061)', () => {
  const cases = [
    ['Input', <Input key="i" label="Email" error="Enter a valid email" />],
    ['Textarea', <Textarea key="t" label="Note" error="Too long" />],
    [
      'Select',
      <Select key="s" label="Policy" error="Choose one" options={[{ value: 'a', label: 'A' }]} />,
    ],
  ] as const;

  it.each(cases)('%s announces its error when it appears', (_name, element) => {
    render(element);
    // role="alert" carries an implicit assertive live region: the submit-time
    // case, where focus is on the button and the field is elsewhere.
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter a valid email|Too long|Choose one/);
  });

  it.each(cases)('%s links the control to its error, for the tab-back case', (_name, element) => {
    const { container } = render(element);
    const control = container.querySelector('input, textarea, select')!;
    const describedBy = control.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // Association, not just proximity: without it the error is read as loose
    // text unattached to the control it is about.
    expect(document.getElementById(describedBy!)).toHaveAttribute('role', 'alert');
    expect(control).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks a healthy field neither invalid nor described-by nothing', () => {
    const { container } = render(<Input label="Email" />);
    const input = container.querySelector('input')!;
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('associates help text without shouting it', () => {
    const { container } = render(<Input label="Phone" helpText="Include the country code" />);
    const input = container.querySelector('input')!;
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    // Help text is context, not an interruption — announcing it assertively
    // would talk over the person.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('gives every field a stable id that survives server rendering', () => {
    // These used to be `Math.random()`, which produces a different id on the
    // server than on the client — an SSR hydration mismatch, and a label whose
    // htmlFor points at nothing.
    const { container } = render(<Input label="Email" />);
    const input = container.querySelector('input')!;
    const label = container.querySelector('label')!;
    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.id).not.toMatch(/^input-[a-z0-9]{9}$/);
  });
});
