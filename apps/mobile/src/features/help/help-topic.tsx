import { View } from 'react-native';
import type { HelpTopic } from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { spacing } from '@/theme';

/**
 * One help topic's sections: a heading, a paragraph, a short list. The words
 * come from `@artist/shared` (`HELP_TOPICS`), next to the permission map, so
 * the sheet, the help page and the web can never explain different rules.
 */
export function HelpTopicBody({
  topic,
  ink,
  soft,
}: {
  topic: HelpTopic;
  ink: string;
  soft: string;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {topic.sections.map((section, index) => (
        <View key={index} style={{ gap: spacing.xs }}>
          {section.heading !== undefined && (
            <PosterText variant="cardTitle" color={ink} accessibilityRole="header">
              {section.heading}
            </PosterText>
          )}
          {section.body !== undefined && (
            <PosterText variant="paragraph" color={soft}>
              {section.body}
            </PosterText>
          )}
          {section.points?.map((point) => (
            <View key={point} style={{ flexDirection: 'row', gap: spacing.sm }}>
              <PosterText variant="paragraph" color={soft} accessible={false}>
                {'•'}
              </PosterText>
              <PosterText variant="paragraph" color={soft} style={{ flex: 1 }}>
                {point}
              </PosterText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
