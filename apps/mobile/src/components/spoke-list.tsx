import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, type IconName } from './icon';
import { Button } from './button';
import { MascotMessage } from './mascot';
import type { PHRASE_LETTERING } from '../../assets/mascots/lottie/lettering';
import { PosterText } from './poster-text';
import { Skeleton } from './skeleton';
import { spacing, useTokens } from '@/theme';
import { toUserMessage } from '@artist/api-client';

/**
 * The four states every list has, in one place: loading, error, empty, content.
 *
 * Empty means *resolved with nothing in it* — it is a designed state that says
 * why and what to do, not a blank area. Loading shows rows in the shape of the
 * eventual list so nothing jumps when data lands.
 */
export function SpokeList({
  pending,
  error,
  onRetry,
  empty,
  emptyIcon,
  emptyTitle,
  emptyBody,
  mascot,
  header,
  children,
}: {
  pending: boolean;
  error?: Error | null;
  onRetry?: () => void;
  empty: boolean;
  emptyIcon: IconName;
  emptyTitle: string;
  emptyBody?: string;
  /**
   * Empty, the mascot says it instead: `phrase` in its hand lettering over the
   * phone's mascot, in place of the icon and `emptyTitle`.
   */
  mascot?: { phrase: keyof typeof PHRASE_LETTERING };
  /** Rendered above the rows, inside the same scroll view. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const tokens = useTokens();

  const content = () => {
    if (pending) {
      return (
        <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ gap: spacing.xs }}>
              <Skeleton width="70%" height={16} />
              <Skeleton width="40%" height={11} />
            </View>
          ))}
        </View>
      );
    }

    if (error) {
      return (
        <Centered>
          <Icon
            name={{ sf: 'exclamationmark.triangle', md: 'warning' }}
            size={28}
            color={tokens.mutedForeground}
          />
          <PosterText variant="title" color={tokens.foreground}>
            Could not load this
          </PosterText>
          <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
            {toUserMessage(error)}
          </PosterText>
          {onRetry && <Button title="Try again" variant="ghost" size="sm" onPress={onRetry} />}
        </Centered>
      );
    }

    if (empty && mascot) {
      return (
        <MascotMessage
          phrase={mascot.phrase}
          label={emptyTitle}
          body={emptyBody}
          color={tokens.mutedForeground}
        />
      );
    }

    if (empty) {
      return (
        <Centered>
          <Icon name={emptyIcon} size={28} color={tokens.mutedForeground} />
          <PosterText variant="title" color={tokens.foreground}>
            {emptyTitle}
          </PosterText>
          {emptyBody !== undefined && (
            <PosterText
              variant="body"
              color={tokens.mutedForeground}
              style={{ textAlign: 'center' }}
            >
              {emptyBody}
            </PosterText>
          )}
        </Centered>
      );
    }

    return <View>{children}</View>;
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
    >
      {header}
      {content()}
    </ScrollView>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xl,
      }}
    >
      {children}
    </View>
  );
}
