import { View } from 'react-native';
import { PosterPill } from '@/components/poster-pill';
import { radius, type WidgetInk } from '@/theme';

/**
 * The status, as the control that changes it. A pill with a chevron rather
 * than a bare dot: it has to read as tappable, and it is the one write a
 * member does most. Without permission it is the same pill, minus the chevron
 * and the press — still saying what the status is.
 *
 * The status's own colour is a dot ringed in the block's ink, since a status
 * colour was never picked to sit on a palette block.
 */
export function StatusPill({
  ink,
  name,
  color,
  onPress,
}: {
  ink: WidgetInk;
  name: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <PosterPill
      ink={ink}
      label={name}
      accessibilityLabel={`Status: ${name}`}
      accessibilityHint={onPress ? 'Changes the status' : undefined}
      chevron={onPress !== undefined}
      onPress={onPress}
      lead={
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: ink.ink,
            backgroundColor: color,
          }}
        />
      }
    />
  );
}
