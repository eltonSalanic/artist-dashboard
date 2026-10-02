import { ComingSoonScreen } from '@/screens/coming-soon';

export default function Calendar() {
  return (
    <ComingSoonScreen
      icon={{ sf: 'calendar', md: 'calendar-month' }}
      title="Calendar"
      body="A month view of shows, rehearsals, meetings, due tasks, goals and reminders — merged across every band you are in."
      phase="P9"
    />
  );
}
