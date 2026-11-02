import { describe, expect, it } from 'vitest';
import { createEvent } from '../core/events';
import { growthSeries } from '../core/growth';
import { growthChartSvg, growthHtml } from './growthChart';

const day = (d: number) => new Date(2026, 9, d, 10).getTime();
const events = [
  createEvent('weight', day(1), { grams: 5000 }, 0),
  createEvent('weight', day(15), { grams: 5600 }, 0),
  createEvent('height', day(15), { cm: 58.5 }, 0),
];

describe('growth chart', () => {
  it('says how to start when nothing has been measured', () => {
    expect(growthHtml([], { units: 'ml', dayStartHour: 0 }, day(20))).toContain('Add a weight or height');
  });

  it('draws a mark with a tooltip per measurement, and a table row per day', () => {
    const html = growthHtml(events, { units: 'ml', dayStartHour: 0 }, day(20));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('.growth-chart[data-kind="weight"] [data-tip]')).toHaveLength(2);
    expect(doc.querySelectorAll('.growth-chart[data-kind="height"] [data-tip]')).toHaveLength(1);
    expect(doc.querySelector('[data-tip]')!.getAttribute('data-tip')).toBe('⚖️ Oct 1 · 5 kg');
    const rows = [...doc.querySelectorAll('.growth-table tbody tr')].map((r) => r.textContent);
    expect(rows).toEqual(['Oct 155.6 kg58.5 cm', 'Oct 15 kg—']);
  });

  it('labels the axis in the chosen units', () => {
    const svg = growthChartSvg(growthSeries(events, 'weight'), 'weight', 'imperial');
    expect(svg).toContain('>lb<');
    expect(svg).toContain('12 lb 5.5 oz');
  });
});
