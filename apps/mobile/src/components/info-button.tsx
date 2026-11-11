import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { HELP_TOPICS, type HelpTopicId } from '@artist/shared';
import { useTokens } from '@/theme';
import { Icon } from './icon';

/**
 * A small (i) that opens one help topic as a sheet. Kept to the few places a
 * rule bites (picking a role, the band fund, the members list): an (i) on
 * every heading would teach people to ignore them.
 */
export function InfoButton({
  topic,
  color,
  size = 18,
}: {
  topic: HelpTopicId;
  /** Defaults to the muted ink of the nearest token set. */
  color?: string;
  size?: number;
}) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`About: ${HELP_TOPICS[topic].title}`}
      hitSlop={12}
      onPress={() => router.push(`/help/${topic}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Icon
        name={{ sf: 'info.circle', md: 'info-outline' }}
        size={size}
        color={color ?? tokens.mutedForeground}
      />
    </Pressable>
  );
}
