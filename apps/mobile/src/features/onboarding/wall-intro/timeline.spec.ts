import {
  BEAT_START,
  CUT,
  LIFT,
  REST,
  TOTAL,
  WALL,
  beatAt,
  cameraAt,
  cubicBezier,
  curtain,
  highlight,
  landing,
  phonePose,
  sweep,
} from './timeline';

describe('cubicBezier', () => {
  it('matches the straight line for a linear curve', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const x of [0, 0.25, 0.5, 0.9, 1]) expect(linear(x)).toBeCloseTo(x, 4);
  });

  it('overshoots past 1 for a spring curve, and still ends at 1', () => {
    const spring = cubicBezier(0.34, 1.56, 0.64, 1);
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => spring(i / 50)));
    expect(peak).toBeGreaterThan(1);
    expect(spring(1)).toBe(1);
  });
});

describe('the timeline', () => {
  it('runs five beats back to back', () => {
    expect(BEAT_START).toEqual([0, 2600, 6300, 9700, 13500]);
    expect(TOTAL).toBe(18100);
    expect(WALL).toBe(2600);
    expect(CUT).toBe(13500);
  });

  it('lifts the welcome card off the whole screen before the wall builds', () => {
    expect(curtain(0)).toBe(1);
    expect(curtain(WALL - LIFT)).toBe(1);
    expect(curtain(WALL - 1)).toBeLessThan(0.05);
    expect(curtain(WALL)).toBe(0);
  });

  it('holds each beat on a frame inside it', () => {
    REST.forEach((rest, beat) => expect(beatAt(rest)).toBe(beat));
  });

  it('keeps a card hidden until it lands, then settles it in its cell', () => {
    expect(landing(699, 700).shown).toBe(false);
    expect(landing(700, 700)).toEqual({ shown: true, away: 1, scale: 1 });
    expect(landing(700 + 860, 700)).toEqual({ shown: true, away: 0, scale: 1 });
  });

  it('brings a highlight up, holds it, and lets it go', () => {
    expect(highlight(999, 1000, 3000)).toBe(0);
    expect(highlight(2000, 1000, 3000)).toBe(1);
    expect(highlight(3001, 1000, 3000)).toBe(0);
  });

  it('brings a headline fully in, then fully out', () => {
    expect(sweep(1150 + 770, 1150)).toEqual({ band: 0, words: 0 });
    expect(sweep(1150 + 1400, 1150).band).toBeCloseTo(-1.15);
  });

  it('rides the camera down for the last cards and back up for the phone', () => {
    expect(cameraAt(0)).toBe(0);
    expect(cameraAt(CUT - 1)).toBe(1);
    expect(cameraAt(TOTAL - 1)).toBe(0);
  });

  it('leaves the wall flat until the cut, then shrinks it to half', () => {
    expect(phonePose(CUT - 1, 200, 0.5).scale).toBe(1);
    expect(phonePose(TOTAL - 1, 200, 0.5).scale).toBeCloseTo(0.5);
  });
});
