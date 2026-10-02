import { ComingSoonScreen } from '@/screens/coming-soon';

export default function Inbox() {
  return (
    <ComingSoonScreen
      icon={{ sf: 'tray', md: 'inbox' }}
      title="Inbox"
      body="Every comment that mentions you, from all of your bands, newest first."
      phase="P9"
    />
  );
}
