import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon, type IconName } from '@/components/icon';
import { useTokens } from '@/theme';

/**
 * A row's leading icon as a done/not-done toggle — a reminder ticked off, a
 * goal completed. Without `onToggle` it is the same icon, inert, so a member
 * still reads the state.
 *
 * The slop makes an 18pt icon a thumb-sized target without moving the row's
 * layout; the row's own press (open the form) still owns everything else.
 */
export function ToggleLead({
  done,
  label,
  idle,
  onToggle,
}: {
  done: boolean;
  /** What the item is, for the screen reader: "Reminder: Book the van". */
  label: string;
  /** The icon when not done. */
  idle: IconName;
  onToggle?: () => void;
}) {
  const tokens = useTokens();
  const icon = (
    <Icon
      name={done ? { sf: 'checkmark.circle.fill', md: 'check-circle' } : idle}
      size={18}
      color={done ? tokens.primary : undefined}
    />
  );
  if (!onToggle) return icon;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      hitSlop={14}
      onPress={() => {
        void Haptics.selectionAsync();
        onToggle();
      }}
    >
      {icon}
    </Pressable>
  );
}
