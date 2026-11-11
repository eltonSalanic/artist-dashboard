import { useLocalSearchParams } from 'expo-router';
import { HelpSheet } from '@/screens/help-sheet';

/** `/help/:topic` — one help topic, as a native sheet. */
export default function HelpTopic() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  return <HelpSheet topic={topic} />;
}
