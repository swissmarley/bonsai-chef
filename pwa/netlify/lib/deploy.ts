import type { Context } from '@netlify/functions';
import { isDev } from './email';

/**
 * Deploy previews and branch deploys run with the production database and photo storage
 * (different values per deploy context need a paid Netlify plan). Only the production deploy
 * and local development may read or write data; every other deploy is a look-only preview.
 */
export function canUseData(context: Pick<Context, 'deploy'>): boolean {
  // Only a production deploy can be the published one; checking both keeps the live site (and its
  // scheduled reminders) working even if one of the two signals were missing.
  return context.deploy?.context === 'production' || context.deploy?.published === true || isDev();
}

export const PREVIEW_MESSAGE = 'Questa è un’anteprima dell’app: i dati sono disponibili solo nella versione pubblicata.';
