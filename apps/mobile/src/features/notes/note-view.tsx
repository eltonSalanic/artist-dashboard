import { Linking, Text, View, type TextStyle } from 'react-native';
import type { NoteNode } from '@artist/shared';
import { ThemedText } from '@/components/themed-text';
import type { TypeVariant } from '@/theme';
import { radius, spacing, useTokens } from '@/theme';

const MONO = process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace';

/**
 * The note, drawn natively from its TipTap document — bold as bold, lists as
 * lists — rather than as the editing dialect's markers. Reading is what the
 * widget is mostly for, and it should look like what web shows.
 *
 * Unknown node types render their text: a document from a newer web editor
 * is still readable here, even where the phone cannot edit it.
 */
export function NoteView({ doc }: { doc: NoteNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {(doc.content ?? []).map((block, index) => (
        <Block key={index} node={block} />
      ))}
    </View>
  );
}

const HEADING: Record<number, TypeVariant> = {
  1: 'title',
  2: 'headline',
};

function Block({ node }: { node: NoteNode }) {
  const tokens = useTokens();

  switch (node.type) {
    case 'paragraph':
      // An empty paragraph is a deliberate gap between blocks.
      return node.content?.length ? (
        <ThemedText variant="body">
          <Inline nodes={node.content} />
        </ThemedText>
      ) : (
        <View style={{ height: spacing.sm }} />
      );

    case 'heading': {
      const level = Number(node.attrs?.level ?? 1);
      return (
        <ThemedText
          variant={HEADING[level] ?? 'subhead'}
          accessibilityRole="header"
          style={[{ marginTop: spacing.xs }, level > 2 && { fontWeight: '600' }]}
        >
          <Inline nodes={node.content} />
        </ThemedText>
      );
    }

    case 'bulletList':
    case 'orderedList':
      return <List node={node} />;

    case 'blockquote':
      return (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: tokens.border,
            paddingLeft: spacing.md,
            gap: spacing.xs,
          }}
        >
          {(node.content ?? []).map((child, index) => (
            <Block key={index} node={child} />
          ))}
        </View>
      );

    case 'codeBlock':
      return (
        <View
          style={{
            backgroundColor: tokens.muted,
            borderRadius: radius.sm,
            padding: spacing.sm,
          }}
        >
          <ThemedText variant="footnote" style={{ fontFamily: MONO }}>
            {(node.content ?? []).map((t) => t.text ?? '').join('')}
          </ThemedText>
        </View>
      );

    case 'horizontalRule':
      return (
        <View
          style={{ height: 1, backgroundColor: tokens.border, marginVertical: spacing.sm }}
        />
      );

    default:
      return node.content?.length ? (
        <View style={{ gap: spacing.xs }}>
          {node.content.map((child, index) =>
            child.type === 'text' || child.type === 'hardBreak' ? (
              <ThemedText key={index} variant="body">
                <Inline nodes={[child]} />
              </ThemedText>
            ) : (
              <Block key={index} node={child} />
            ),
          )}
        </View>
      ) : null;
  }
}

function List({ node }: { node: NoteNode }) {
  const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
  return (
    <View accessibilityRole="list" style={{ gap: spacing.xs }}>
      {(node.content ?? []).map((item, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: spacing.sm }}>
          <ThemedText
            variant="body"
            tone="muted"
            style={{ minWidth: node.type === 'orderedList' ? 22 : 12, textAlign: 'right' }}
          >
            {node.type === 'orderedList' ? `${start + index}.` : '•'}
          </ThemedText>
          <View style={{ flex: 1, gap: spacing.xs }}>
            {(item.content ?? []).map((child, i) => (
              <Block key={i} node={child} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Runs of text with their marks, nested in the block's own Text. */
function Inline({ nodes = [] }: { nodes?: NoteNode[] }) {
  const tokens = useTokens();
  return nodes.map((node, index) => {
    if (node.type === 'hardBreak') return '\n';
    if (node.type !== 'text') return null;

    const style: TextStyle = {};
    const decorations: string[] = [];
    let href: string | null = null;
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') style.fontWeight = '700';
      if (mark.type === 'italic') style.fontStyle = 'italic';
      if (mark.type === 'strike') decorations.push('line-through');
      if (mark.type === 'underline') decorations.push('underline');
      if (mark.type === 'code') {
        style.fontFamily = MONO;
        style.backgroundColor = tokens.muted;
      }
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
        href = mark.attrs.href;
        style.color = tokens.primary;
        decorations.push('underline');
      }
    }
    if (decorations.length) {
      style.textDecorationLine = decorations.join(' ') as TextStyle['textDecorationLine'];
    }

    const target = href;
    return (
      <Text
        key={index}
        style={style}
        accessibilityRole={target ? 'link' : undefined}
        // Only http(s): a note is written by anyone in the band, and a tap on
        // it should not be able to launch some other app's scheme.
        onPress={
          target && /^https?:\/\//i.test(target) ? () => void Linking.openURL(target) : undefined
        }
      >
        {node.text}
      </Text>
    );
  });
}
