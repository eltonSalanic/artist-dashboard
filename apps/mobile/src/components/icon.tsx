import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useTokens } from '@/theme';

/**
 * One icon, two platforms.
 *
 * SF Symbols are an Apple asset and render nothing on Android, so every icon
 * needs a Material counterpart — an app that ships SF-only iconography ships
 * blank icons on half its devices. Each caller passes both names, and this
 * picks. (Emoji would avoid the problem and is the other named slop tell.)
 *
 * `process.env.EXPO_OS` rather than `Platform.OS`: it is inlined at build time,
 * so the branch not taken is dropped from the bundle instead of shipped.
 */
export interface IconName {
  /** SF Symbol name, e.g. `bolt.fill`. */
  sf: SFSymbol;
  /** Material icon name, e.g. `bolt`. */
  md: React.ComponentProps<typeof MaterialIcons>['name'];
}

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  /** Defaults to the nearest token set's foreground. */
  color?: string;
}) {
  const tokens = useTokens();
  const tint = color ?? tokens.foreground;

  return process.env.EXPO_OS === 'ios' ? (
    <SymbolView
      name={name.sf}
      tintColor={tint}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  ) : (
    <MaterialIcons name={name.md} size={size} color={tint} />
  );
}
