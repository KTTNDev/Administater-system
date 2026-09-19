'use server';
import {requireUser} from '@/lib/auth';
import {backupCatalog,restoreCatalogBackup} from '@/lib/backup-catalog';
export async function listBackups(){await requireUser();return backupCatalog();}
export async function restoreBackupCopy(name:string){await requireUser();return restoreCatalogBackup(name);}
