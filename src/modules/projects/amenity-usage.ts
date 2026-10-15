/** Descriptive usage facts live on ProjectAmenity, never in Unit amenity arrays. */
export function amenityRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function isRange(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string'
    && typeof value[1] === 'string' && time.test(value[0]) && (time.test(value[1]) || value[1] === '24:00');
}
export function singleAmenityHours(value: unknown): [string, string] | null {
  // Older public pages render string values directly; safely accept this import form too.
  if (typeof value === 'string') {
    const pair = value.split(/[–-]/).map(part => part.trim());
    return isRange(pair) ? pair : null;
  }
  return Array.isArray(value) && value.length === 1 && isRange(value[0]) ? value[0] : null;
}
export function hasSimpleAmenityHours(value: unknown): boolean {
  if (value == null) return true;
  const record = amenityRecord(value);
  return Object.keys(record).length > 0
    && Object.keys(record).every(key => ['daily', 'staffContact', 'timezone'].includes(key))
    && (record.daily == null || singleAmenityHours(record.daily) !== null)
    && (record.staffContact == null || singleAmenityHours(record.staffContact) !== null);
}
export function amenityLinesInput(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value.join('\n');
  return JSON.stringify(value, null, 2);
}
export function parseAmenityLines(value: string): unknown {
  const text = value.trim();
  if (!text) return null;
  if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text);
  return text.split('\n').map(line => line.trim()).filter(Boolean);
}
export function amenityHoursFromForm(form: FormData, previous: unknown): unknown {
  if (form.get('hoursMode') === 'custom') return parseAmenityLines(String(form.get('openingHours') || ''));
  const result = { ...amenityRecord(previous) };
  delete result.daily;
  delete result.staffContact;
  const read = (key: string) => String(form.get(key) || '').trim();
  const range = (start: string, end: string) => {
    if (!start && !end) return undefined;
    if (!isRange([start, end]) || start === end) throw new Error('Enter both opening and closing times; use 24 hours for all-day access.');
    return [[start, end]];
  };
  const previousRecord = amenityRecord(previous);
  // HTML time controls use 00:00; retain an existing end-of-day 24:00 value on round trip.
  const endTime = (value: string, prior: unknown) => value === '00:00' && singleAmenityHours(prior)?.[1] === '24:00' ? '24:00' : value;
  const daily = form.get('hoursOpen24h') === 'on' ? [['00:00', '24:00']] : range(read('hoursOpen'), endTime(read('hoursClose'), previousRecord.daily));
  const staff = range(read('staffHoursOpen'), endTime(read('staffHoursClose'), previousRecord.staffContact));
  if (daily) result.daily = daily;
  if (staff) result.staffContact = staff;
  const timezone = read('hoursTimezone');
  if (timezone) {
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
    catch { throw new Error('Enter a valid time zone, such as Asia/Bangkok.'); }
    if (daily || staff || Object.keys(result).length) result.timezone = timezone;
  }
  return Object.keys(result).length ? result : null;
}
export function amenityUsageLines(value: unknown, labels: Record<string, string> = {}): string[] {
  if (value == null || value === '') return [];
  if (isRange(value)) return [value[0] === '00:00' && value[1] === '24:00' ? (labels.allDay || '00:00–24:00') : value.join('–')];
  if (Array.isArray(value)) return value.flatMap(item => amenityUsageLines(item, labels));
  if (typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => {
    const name = labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
    return amenityUsageLines(item, labels).map(line => `${name}: ${line}`);
  });
  return [String(value)];
}
export function amenityLeadTime(value: unknown): { amount: number; unit: 'days' | 'hours' | 'minutes' } | null {
  const minutes = amenityRecord(value).minLeadMinutes;
  if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes <= 0) return null;
  if (minutes % 1440 === 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes % 60 === 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

export function amenityLeadTimeFromForm(form: FormData): number | undefined {
  const amount = form.get('leadTimeAmount');
  if (amount === null || amount === '') return undefined;
  const value = Number(amount);
  const unit = Number(form.get('leadTimeUnit'));
  if (!Number.isInteger(value) || value < 0 || ![1, 60, 1440].includes(unit) || value * unit > 525600) {
    throw new Error('Enter a whole-number booking notice of up to one year.');
  }
  return value * unit;
}
