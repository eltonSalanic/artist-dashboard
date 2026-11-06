import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { notify } from '@artist/api-client';
import { financeCsv, type FinanceEntryDto, type FinanceMemberRef } from '@artist/shared';
import { reportError } from '@/lib/report-error';

/**
 * The ledger as a spreadsheet, through the share sheet: "Save to Files",
 * mail it to the accountant, AirDrop it. Same columns as web's export.
 */
export async function shareFinanceCsv(
  entries: readonly FinanceEntryDto[],
  members: FinanceMemberRef[],
  label: string,
) {
  try {
    const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? 'Former member';
    const csv = financeCsv([...entries], name);
    const file = new File(Paths.cache, `band-finances-${label.replace(/\s+/g, '-')}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Band finances',
    });
  } catch (error) {
    reportError(error);
    notify.error('Could not export the spreadsheet. Try again.');
  }
}
