import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  applyMention,
  findMentionQuery,
  matchMembers,
  type MentionTarget,
} from '@artist/shared';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, type, useTokens } from '@/theme';

/**
 * A multiline input with `@`-mention suggestions — the phone's version of the
 * web composer, sharing its parser from `@artist/shared`.
 *
 * Suggestions are a row of chips directly above the field rather than a
 * floating popup: a popup over a scroll view on a phone covers the very text
 * being typed, and a chip row is the pattern the keyboard's own suggestion bar
 * already taught. No arrow-key navigation to port — a tap is the selection.
 *
 * The parent owns the text, so it can derive mention ids on submit.
 */
export function CommentComposer({
  value,
  onChange,
  members,
  onSubmit,
  onCancel,
  submitLabel = 'Comment',
  placeholder = 'Write a comment…  @ to mention',
  autoFocus,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  members: MentionTarget[];
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  busy?: boolean;
}) {
  const tokens = useTokens();
  const [caret, setCaret] = useState(value.length);
  // Set only for the one render after a mention is inserted, to put the caret
  // after it. Left controlled, `selection` fights the keyboard on Android.
  const [placeCaret, setPlaceCaret] = useState<number | null>(null);

  // Clamped: the text can shrink under a stale caret (cleared after sending).
  const query = findMentionQuery(value, Math.min(caret, value.length));
  const matches = query ? matchMembers(members, query.query) : [];

  const choose = (target: MentionTarget) => {
    if (!query) return;
    const next = applyMention(value, query.start, caret, target.displayName);
    onChange(next.text);
    setCaret(next.caret);
    setPlaceCaret(next.caret);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {matches.length > 0 && (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs }}
          accessibilityLabel="People to mention"
        >
          {matches.map((target) => (
            <Pressable
              key={target.id}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${target.displayName}`}
              onPress={() => choose(target)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs + 2,
                borderRadius: radius.full,
                backgroundColor: pressed ? tokens.accent : tokens.muted,
              })}
            >
              <ThemedText variant="subhead" style={{ fontWeight: '600' }}>
                @{target.displayName}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <TextInput
        multiline
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={tokens.mutedForeground}
        value={value}
        onChangeText={onChange}
        selection={
          placeCaret === null ? undefined : { start: placeCaret, end: placeCaret }
        }
        onSelectionChange={(event) => {
          setCaret(event.nativeEvent.selection.end);
          if (placeCaret !== null) setPlaceCaret(null);
        }}
        style={[
          type.body,
          {
            minHeight: 88,
            maxHeight: 200,
            textAlignVertical: 'top',
            color: tokens.foreground,
            backgroundColor: tokens.card,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm + 4,
            paddingBottom: spacing.sm + 4,
          },
        ]}
      />

      <View
        style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}
      >
        {onCancel && (
          <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} />
        )}
        <Button
          title={submitLabel}
          size="sm"
          loading={busy}
          disabled={!value.trim()}
          onPress={onSubmit}
        />
      </View>
    </View>
  );
}
