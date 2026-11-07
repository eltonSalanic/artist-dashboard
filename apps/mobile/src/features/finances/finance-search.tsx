import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icon';
import { TextInput } from '@/components/text-input';
import { posterInput, posterRadius, spacing, useTokens } from '@/theme';

/** The search box over a ledger list: what it was for, the note, who was paid. */
export function FinanceSearch({
  value,
  onChange,
  placeholder = 'Search entries…',
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}) {
  const tokens = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        backgroundColor: tokens.muted,
      }}
    >
      <Icon
        name={{ sf: 'magnifyingglass', md: 'search' }}
        size={15}
        color={tokens.mutedForeground}
      />
      <TextInput
        accessibilityLabel="Search entries"
        placeholder={placeholder}
        placeholderTextColor={tokens.mutedForeground}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[
          posterInput,
          {
            flex: 1,
            color: tokens.foreground,
            paddingVertical: spacing.sm + 3,
          },
        ]}
      />
      {value !== '' && process.env.EXPO_OS === 'android' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
          onPress={() => onChange('')}
        >
          <Icon
            name={{ sf: 'xmark.circle.fill', md: 'cancel' }}
            size={16}
            color={tokens.mutedForeground}
          />
        </Pressable>
      )}
    </View>
  );
}
