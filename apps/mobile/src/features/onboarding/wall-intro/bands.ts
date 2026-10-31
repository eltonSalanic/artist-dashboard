import type { BoardPalette } from '@artist/shared';

/**
 * Whose wall the welcome preview builds. It changes on every loop, so someone
 * watching for a while sees the wall belong to a few different bands, each in
 * the palette that suits it. Real bands make the point faster than a made-up
 * one, and the screen says they don't endorse Band Wall.
 *
 * Only the Shows and Notes cards change per band (the next show, and a setlist
 * in Notes); the rest of the wall is the same demo numbers every time.
 *
 * Setlists are kept to about two lines so the Notes card still has room for
 * its "edited" line.
 */
export interface DemoBand {
  name: string;
  palette: BoardPalette;
  /** The next show: the day the Shows card leads with, and where. */
  show: { day: string; venue: string };
  /** The Notes card's prose. */
  note: string;
}

const band = (
  name: string,
  palette: BoardPalette,
  day: string,
  venue: string,
  setlist: string,
): DemoBand => ({ name, palette, show: { day, venue }, note: `Setlist: ${setlist}` });

export const DEMO_BANDS: readonly DemoBand[] = [
  band('My Chemical Romance', 'mono', 'Fri', 'The Forum', 'Helena, Teenagers, then Welcome to the Black Parade'),
  band('Turnstile', 'playful', 'Sat', 'The Ottobar', 'Mystery, Blackout, then Holiday to close'),
  band('The Beatles', 'ocean', 'Thu', 'The Cavern Club', 'Twist and Shout, She Loves You, I Saw Her Standing There'),
  band('Paramore', 'playful', 'Sat', 'The Ryman', "Misery Business, Hard Times, then Ain't It Fun to close"),
  band('Nirvana', 'mono', 'Fri', 'The Crocodile', 'In Bloom, Lithium, then Smells Like Teen Spirit'),
  band('boygenius', 'forest', 'Sun', 'Brooklyn Steel', '$20, Cool About It, then Not Strong Enough'),
  band('Queen', 'sunset', 'Sat', 'Wembley', 'Bohemian Rhapsody, Radio Ga Ga, We Are the Champions'),
  band('Arctic Monkeys', 'mono', 'Thu', 'The Leadmill', 'R U Mine?, 505, then Do I Wanna Know? to close'),
  band('Wet Leg', 'ocean', 'Wed', 'The Garage', 'Wet Dream, Angelica, then Chaise Longue'),
  band('Green Day', 'sunset', 'Fri', '924 Gilman', 'Basket Case, American Idiot, then Good Riddance'),
  band('Fleetwood Mac', 'forest', 'Sun', 'The Troubadour', 'Dreams, Rhiannon, The Chain, then Go Your Own Way'),
  band('IDLES', 'playful', 'Sat', 'The Fleece', 'Colossus, Danny Nedelko, then Never Fight a Man With a Perm'),
  band('Foo Fighters', 'sunset', 'Fri', 'The Roxy', 'My Hero, Best of You, then Everlong to close'),
  band('Tame Impala', 'ocean', 'Sat', 'Red Rocks', 'Let It Happen, Elephant, then The Less I Know the Better'),
  band('Fall Out Boy', 'mono', 'Thu', 'The Metro', "Dance, Dance, Thnks fr th Mmrs, Sugar, We're Goin Down"),
  band('Alvvays', 'ocean', 'Wed', "Lee's Palace", 'Archie, Marry Me, Dreams Tonite, then Belinda Says'),
  band('The Rolling Stones', 'sunset', 'Sat', 'The Marquee', 'Start Me Up, Paint It Black, then Gimme Shelter'),
  band('Radiohead', 'forest', 'Sun', 'Brixton Academy', 'Creep, Karma Police, then Paranoid Android'),
  band('Khruangbin', 'sunset', 'Fri', 'The Fillmore', 'White Gloves, Maria También, then Evan Finds the Third Room'),
  band('blink-182', 'playful', 'Sat', 'The Casbah', "Dammit, What's My Age Again?, then All the Small Things"),
  band('Led Zeppelin', 'mono', 'Thu', 'Royal Albert Hall', 'Black Dog, Whole Lotta Love, then Stairway to Heaven'),
  band('Japanese Breakfast', 'playful', 'Fri', 'Union Transfer', 'Be Sweet, Kokomo, IN, then Everybody Wants to Love You'),
  band('Red Hot Chili Peppers', 'sunset', 'Sat', 'The Palladium', "Can't Stop, Californication, then Under the Bridge"),
  band('Fontaines D.C.', 'forest', 'Wed', 'Vicar Street', 'Big, Boys in the Better Land, then Starburster'),
  band('Linkin Park', 'mono', 'Fri', 'The Whisky', 'Faint, Numb, then In the End to close'),
  band('Coldplay', 'ocean', 'Sun', 'Rose Bowl', 'Yellow, The Scientist, then Fix You'),
  band('Gorillaz', 'playful', 'Sat', 'The Roundhouse', 'Clint Eastwood, On Melancholy Hill, then Feel Good Inc.'),
];
