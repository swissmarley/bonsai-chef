import type { Context } from '@netlify/functions';
import { isDev } from './email';

/**
 * Deploy previews and branch deploys run with the production database and photo storage
 * (different values per deploy context need a paid Netlify plan). Only the production deploy
 * and local development may read or write data; every other deploy is a look-only preview.
 */
export function canUseData(context: Pick<Context, 'deploy'>): boolean {
  return context.deploy?.context === 'production' || isDev();
}

export const PREVIEW_MESSAGE = 'Questa è un’anteprima dell’app: i dati sono disponibili solo nella versione pubblicata.';
