import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LinkParentKind } from '@artist/shared';
import {
  notify,
  useItemLinks,
  useMe,
  usePermissions,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { posterRadius, spacing, useTokens } from '@/theme';

export function ItemLinksSection({
  boardId,
  kind,
  parentId,
}: {
  boardId: string;
  kind: LinkParentKind;
  parentId: string;
}) {
  const tokens = useTokens();
  const links = useItemLinks(boardId, kind, parentId);
  const { can } = usePermissions();
  const me = useMe(true);
  const list = links.data ?? [];

  return (
    <Section title={list.length ? `LINKS · ${list.length}` : 'LINKS'}>
      {links.isPending && <Skeleton width="100%" height={60} />}
      {links.isError && (
        <View style={styles.stack}>
          <PosterText variant="cardMeta" color={tokens.destructive} selectable>
            Could not load links.
          </PosterText>
          <Button
            title="Try again"
            variant="ghost"
            size="sm"
            disabled={links.isFetching}
            onPress={() => void links.refetch()}
          />
        </View>
      )}
      <View style={styles.stack}>
        {list.map((link) => (
          <View
            key={link.id}
            style={[styles.row, { backgroundColor: tokens.muted }]}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${link.title}, ${link.url}`}
              accessibilityHint="Opens in your browser"
              onPress={() => {
                void Linking.openURL(link.url).catch(() =>
                  notify.error('Could not open the link. Try again.'),
                );
              }}
              style={({ pressed }) => [
                styles.link,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name="link-outline"
                size={20}
                color={tokens.foreground}
              />
              <View style={styles.text}>
                <PosterText variant="cardTitle" color={tokens.foreground}>
                  {link.title}
                </PosterText>
                <PosterText
                  variant="cardMeta"
                  color={tokens.mutedForeground}
                  numberOfLines={1}
                >
                  {link.url}
                </PosterText>
              </View>
              <Ionicons
                name="open-outline"
                size={18}
                color={tokens.mutedForeground}
              />
            </Pressable>
            {(link.createdById === me.data?.user.id || can('link.manage')) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove link ${link.title}`}
                accessibilityState={{ disabled: links.remove.isPending }}
                disabled={links.remove.isPending}
                onPress={() =>
                  Alert.alert(`Remove “${link.title}”?`, undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => links.remove.mutate(link.id),
                    },
                  ])
                }
                style={({ pressed }) => [
                  styles.remove,
                  { opacity: pressed || links.remove.isPending ? 0.5 : 1 },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={tokens.mutedForeground}
                />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {links.isSuccess && list.length === 0 && (
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          Attach a shared drive, spreadsheet, or any web link.
        </PosterText>
      )}
      {can('link.add') && (
        <Button
          title="Add a link"
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push(
              `/board/${boardId}/form/item-link?on=${kind}&parentId=${parentId}`,
            )
          }
        />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: posterRadius.block,
    borderCurve: 'continuous',
  },
  link: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 48,
  },
  text: { flex: 1, minWidth: 0, gap: spacing.xs },
  remove: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
