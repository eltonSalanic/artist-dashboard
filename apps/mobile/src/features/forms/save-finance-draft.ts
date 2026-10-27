import type { CreateFinanceEntryDto } from '@artist/shared';
import type { UploadSource } from '@artist/api-client';

export interface FinanceDraftProgress {
  entryId?: string;
}

/** Keep creation progress when a later upload fails, so retries reuse the entry. */
export async function saveFinanceDraft(
  progress: FinanceDraftProgress,
  fields: CreateFinanceEntryDto,
  receipt: UploadSource | null,
  actions: {
    create: (fields: CreateFinanceEntryDto) => Promise<{ id: string }>;
    update: (id: string, fields: CreateFinanceEntryDto) => Promise<unknown>;
    upload: (id: string, receipt: UploadSource) => Promise<unknown>;
  },
) {
  if (progress.entryId) {
    await actions.update(progress.entryId, fields);
  } else {
    const created = await actions.create(fields);
    progress.entryId = created.id;
  }
  if (receipt) await actions.upload(progress.entryId, receipt);
}
