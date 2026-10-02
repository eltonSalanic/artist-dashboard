import { DEFAULT_BOARD_LAYOUT, packInOrder, readingOrder, type LayoutItem } from './layout';

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

describe('packInOrder', () => {
  it('keeps every width and height, and reads back in the order given', () => {
    const order = readingOrder(DEFAULT_BOARD_LAYOUT).reverse();
    const packed = packInOrder(order);
    expect(readingOrder(packed).map((i) => i.widgetType)).toEqual(order.map((i) => i.widgetType));
    for (const placed of packed) {
      const before = order.find((i) => i.widgetType === placed.widgetType)!;
      expect([placed.w, placed.h]).toEqual([before.w, before.h]);
    }
  });

  it('wraps to a new row when the next widget does not fit', () => {
    const packed = packInOrder([item('TODOS', 0, 0, 8, 6), item('GOALS', 0, 0, 6, 4), item('SHOWS', 0, 0, 6, 3)]);
    expect(packed.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [0, 6],
      [6, 6],
    ]);
  });

  it('never overlaps or leaves the grid', () => {
    const packed = packInOrder(DEFAULT_BOARD_LAYOUT);
    for (const a of packed) {
      expect(a.x + a.w).toBeLessThanOrEqual(12);
      for (const b of packed) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });

  it('puts hidden widgets after the visible ones', () => {
    const packed = packInOrder([{ ...item('FOCUS', 0, 0), hidden: true }, item('GOALS', 0, 0)]);
    expect(readingOrder(packed).map((i) => i.widgetType)).toEqual(['GOALS', 'FOCUS']);
    expect(packed.find((i) => i.widgetType === 'FOCUS')?.hidden).toBe(true);
  });
});
