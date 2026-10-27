import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  applyMention,
  findMentionQuery,
  matchMembers,
  type MentionTarget,
} from '@artist/shared';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { poster, posterRadius, radius, spacing, useTokens } from '@/theme';

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
 *
 * The field is the forms' flat filled box (`TextField`) rather than an
 * outlined card, in the face people's comments are read in. Multiline, so it
 * keeps the line height a single-line input has to drop.
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
              <PosterText variant="chip" color={tokens.foreground}>
                {`@${target.displayName}`}
              </PosterText>
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
          poster.field,
          {
            minHeight: 88,
            maxHeight: 200,
            textAlignVertical: 'top',
            color: tokens.foreground,
            backgroundColor: tokens.muted,
            borderRadius: posterRadius.block,
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
