import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage';
import { R2ObjectStorage } from './r2-object-storage';
import { StorageService } from './storage.service';
import { SupabaseObjectStorage } from './supabase-object-storage';

export type StorageProvider = 'supabase' | 'r2';

/**
 * `STORAGE_PROVIDER` picks where files live: `supabase` (the default, and
 * what local dev runs on) or `r2`. Nothing outside this module names a
 * provider, so adding one is a class here and a case in the factory.
 */
export function createObjectStorage(config: ConfigService): ObjectStorage {
  const provider =
    config.get<StorageProvider>('STORAGE_PROVIDER') ?? 'supabase';
  return provider === 'r2'
    ? new R2ObjectStorage(config)
    : new SupabaseObjectStorage(config);
}

@Module({
  providers: [
    StorageService,
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: createObjectStorage,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
