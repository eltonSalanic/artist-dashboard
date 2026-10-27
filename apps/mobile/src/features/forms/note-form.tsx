import { useRef, useState } from 'react';
import { Alert, Pressable, View, type TextStyle } from 'react-native';
import { router, Stack } from 'expo-router';
import {
  isMarkdownEditable,
  markdownToNote,
  noteToMarkdown,
  type NoteNode,
} from '@artist/shared';
import {
  useCustomWidget,
  usePermissions,
  useSaveCustomWidget,
  type CustomWidgetDto,
} from '@artist/api-client';
import { TextInput } from '@/components/text-input';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { toggleList, toggleWrap, type Edit, type Selection } from '@/features/notes/editing';
import { radius, spacing, type, useThemeColors } from '@/theme';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';

/**
 * The band's shared note, edited as text. The note is a TipTap document; this
 * edits the dialect from `@artist/shared`'s `note-markdown` and converts on
 * save. A note the dialect cannot carry exactly is not offered for editing
 * at all — see `isMarkdownEditable`.
 */
export function NoteForm({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const note = useCustomWidget(boardId);

  return (
    <FormGate
      allowed={can('widget.manage')}
      pending={note.isPending}
      missing={!note.data}
      what="note"
    >
      {note.data &&
        (isMarkdownEditable(note.data.content) ? (
          <NoteFields boardId={boardId} note={note.data} />
        ) : (
          <NotEditable />
        ))}
    </FormGate>
  );
}

function NotEditable() {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <Stack.Screen options={{ title: 'Note' }} />
      <ThemedText variant="headline" style={{ textAlign: 'center' }}>
        Edit this one on web
      </ThemedText>
      <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
        It uses formatting the phone can&apos;t edit without losing, such as underline
        or a list inside a quote. You can still read it here.
      </ThemedText>
      <Button title="Close" variant="ghost" size="sm" onPress={() => router.back()} />
    </View>
  );
}

const TOOLS: { label: string; hint: string; style: TextStyle; apply: (text: string, s: Selection) => Edit }[] = [
  { label: 'B', hint: 'Bold', style: { fontWeight: '800' }, apply: (t, s) => toggleWrap(t, s, '**') },
  { label: 'I', hint: 'Italic', style: { fontStyle: 'italic' }, apply: (t, s) => toggleWrap(t, s, '*') },
  {
    label: 'S',
    hint: 'Strikethrough',
    style: { textDecorationLine: 'line-through' },
    apply: (t, s) => toggleWrap(t, s, '~~'),
  },
  { label: '•', hint: 'Bulleted list', style: {}, apply: (t, s) => toggleList(t, s, 'bullet') },
  { label: '1.', hint: 'Numbered list', style: {}, apply: (t, s) => toggleList(t, s, 'number') },
];

function NoteFields({ boardId, note }: { boardId: string; note: CustomWidgetDto }) {
  const colors = useThemeColors();
  const latest = useCustomWidget(boardId);
  const save = useSaveCustomWidget(boardId);

  const initial = noteToMarkdown(note.content as unknown as NoteNode);
  const [text, setText] = useState(initial);
  const [selection, setSelection] = useState<Selection>({ start: initial.length, end: initial.length });
  // Set only for the render after a toolbar edit, to put the selection where
  // the edit says. Left controlled, `selection` fights the keyboard.
  const [placed, setPlaced] = useState<Selection | null>(null);
  const openedAt = useRef(note.updatedAt);

  const apply = (tool: (typeof TOOLS)[number]) => {
    const edit = tool.apply(text, selection);
    setText(edit.text);
    setSelection(edit.selection);
    setPlaced(edit.selection);
  };

  /**
   * Last write wins on this note, on web too. What the phone adds is a check:
   * if someone saved it elsewhere since this was opened, ask before
   * overwriting their words.
   */
  const confirmOverwrite = async () => {
    const fresh = await latest.refetch();
    if (fresh.data?.updatedAt === openedAt.current) return;
    await new Promise<void>((resolve, reject) =>
      Alert.alert(
        'Someone else changed this note',
        'It was saved on another device after you opened it. Saving replaces their version with yours.',
        [
          { text: 'Keep editing', style: 'cancel', onPress: () => reject(new Error('kept')) },
          { text: 'Replace theirs', style: 'destructive', onPress: () => resolve() },
        ],
        { cancelable: true, onDismiss: () => reject(new Error('kept')) },
      ),
    );
  };

  const onSave = async () => {
    await confirmOverwrite();
    await save.mutateAsync({ title: note.title, content: markdownToNote(text) });
  };

  return (
    <FormScreen
      title={note.title || 'Note'}
      dirty={text !== initial}
      canSave={text !== initial}
      saving={save.isPending}
      onSave={onSave}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.label}
              accessibilityRole="button"
              accessibilityLabel={tool.hint}
              onPress={() => apply(tool)}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                backgroundColor: pressed ? colors.accent : colors.muted,
              })}
            >
              <ThemedText variant="headline" style={tool.style}>
                {tool.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <ThemedText variant="footnote" tone="muted">
          **bold**  *italic*  ~~strike~~  - list  1. list  # heading — shown as
          formatting once saved.
        </ThemedText>
      </View>

      <TextInput
        multiline
        autoFocus
        accessibilityLabel="Note"
        value={text}
        onChangeText={setText}
        selection={placed ?? undefined}
        onSelectionChange={(event) => {
          setSelection(event.nativeEvent.selection);
          if (placed) setPlaced(null);
        }}
        // Grows with its text and lets the form's scroll view scroll, so the
        // keyboard-inset handling there keeps the caret in view.
        scrollEnabled={false}
        textAlignVertical="top"
        placeholder="Setlists, gear, who's driving…"
        placeholderTextColor={colors.mutedForeground}
        style={[
          type.body,
          {
            minHeight: 280,
            color: colors.foreground,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            padding: spacing.md,
          },
        ]}
      />
    </FormScreen>
  );
}
