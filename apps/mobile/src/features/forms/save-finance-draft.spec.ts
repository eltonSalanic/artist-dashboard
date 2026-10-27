import type { CreateFinanceEntryDto } from '@artist/shared';
import type { UploadSource } from '@artist/api-client';
import { saveFinanceDraft, type FinanceDraftProgress } from './save-finance-draft';

const fields: CreateFinanceEntryDto = {
  kind: 'EXPENSE',
  category: 'GEAR',
  amountCents: 100,
  occurredOn: '2026-10-23',
  state: 'SETTLED',
};
const receipt: UploadSource = {
  fileName: 'receipt.jpg',
  contentType: 'image/jpeg',
  size: 100,
  put: async () => undefined,
};
const actions = () => ({
  create: jest.fn().mockResolvedValue({ id: 'saved-entry' }),
  update: jest.fn().mockResolvedValue(undefined),
  upload: jest.fn().mockResolvedValue(undefined),
});

it('waits for creation and uploads to the returned record', async () => {
  const api = actions();
  const progress: FinanceDraftProgress = {};
  await saveFinanceDraft(progress, fields, receipt, api);
  expect(api.upload).toHaveBeenCalledWith('saved-entry', receipt);
  expect(api.update).not.toHaveBeenCalled();
  expect(progress.entryId).toBe('saved-entry');
});

it('retries a failed upload against the saved entry, including edited fields', async () => {
  const api = actions();
  const progress: FinanceDraftProgress = {};
  api.upload.mockRejectedValueOnce(new Error('offline'));
  await expect(saveFinanceDraft(progress, fields, receipt, api)).rejects.toThrow('offline');
  const edited = { ...fields, note: 'Updated before retry' };
  await saveFinanceDraft(progress, edited, receipt, api);
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.update).toHaveBeenCalledWith('saved-entry', edited);
  expect(api.upload).toHaveBeenCalledTimes(2);
});

it('allows removing a failed receipt and finishing without another entry', async () => {
  const api = actions();
  const progress: FinanceDraftProgress = {};
  api.upload.mockRejectedValueOnce(new Error('offline'));
  await expect(saveFinanceDraft(progress, fields, receipt, api)).rejects.toThrow();
  await saveFinanceDraft(progress, fields, null, api);
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.upload).toHaveBeenCalledTimes(1);
});

it('does not upload or mark the draft saved when creation fails', async () => {
  const api = actions();
  const progress: FinanceDraftProgress = {};
  api.create.mockRejectedValueOnce(new Error('save failed'));
  await expect(saveFinanceDraft(progress, fields, receipt, api)).rejects.toThrow('save failed');
  expect(progress.entryId).toBeUndefined();
  expect(api.upload).not.toHaveBeenCalled();
  await saveFinanceDraft(progress, fields, null, api);
  expect(api.create).toHaveBeenCalledTimes(2);
  expect(api.upload).not.toHaveBeenCalled();
});
