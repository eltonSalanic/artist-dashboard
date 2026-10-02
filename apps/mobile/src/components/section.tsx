import type { ReactNode } from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { ThemedText } from './themed-text';

/**
 * A labelled group on a detail screen: a small caps caption, then its content.
 * `action` sits at the caption's right edge, for the one control that belongs
 * to the whole group.
 */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 20,
        }}
      >
        <ThemedText variant="caption" tone="muted">
          {title}
        </ThemedText>
        {action}
      </View>
      {children}
    </View>
  );
}
