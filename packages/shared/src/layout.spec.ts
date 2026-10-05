import { readingOrder, type LayoutItem } from './layout';

const item = (widgetType: LayoutItem['widgetType'], x: number, y: number, w = 4, h = 4): LayoutItem => ({
  widgetType,
  x,
  y,
  w,
  h,
});

describe('readingOrder', () => {
  // The bug this exists for: the merged layout comes back in the shipped
  // default's order, so a phone reading the array ignored every web reorder.
  it('reads positions, not array order', () => {
    const layout = [item('FOCUS', 0, 8), item('TODOS', 4, 0), item('GOALS', 0, 0)];
    expect(readingOrder(layout).map((i) => i.widgetType)).toEqual(['GOALS', 'TODOS', 'FOCUS']);
  });

  it('leaves the input alone', () => {
    const layout = [item('FOCUS', 0, 8), item('GOALS', 0, 0)];
    readingOrder(layout);
    expect(layout[0].widgetType).toBe('FOCUS');
  });
});
