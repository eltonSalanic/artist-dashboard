import type { ReactNode } from 'react';
import { View } from 'react-native';
import { spacing, useTokens } from '@/theme';
import { PosterText } from './poster-text';

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
  const tokens = useTokens();
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
        <PosterText variant="label" color={tokens.mutedForeground} accessibilityRole="header">
          {title}
        </PosterText>
        {action}
      </View>
      {children}
    </View>
  );
}
