import { showPhase, type ShowPhase, type ShowStatusCategory } from '@artist/shared';

/**
 * What a show's status reads as: the band's own name, or "Played" once a held
 * or booked show's date has passed. The phone's twin of web's ShowStatusPill.
 */
export function showStatusLabel(
  status: { name: string; category: ShowStatusCategory } | null | undefined,
  startsAt: string,
  endsAt?: string | null,
): { label: string; phase: ShowPhase } | null {
  if (!status) return null;
  const phase = showPhase({ startsAt, endsAt }, status.category);
  return { label: phase === 'PLAYED' ? 'Played' : status.name, phase };
}
