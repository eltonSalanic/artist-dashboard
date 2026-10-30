import { useLocalSearchParams } from 'expo-router';
import { BandLiveScreen } from '@/screens/band-live';

/** `/band-live?boardId=` — "You're live", right after a new band is created. */
export default function BandLive() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return <BandLiveScreen boardId={boardId} />;
}
