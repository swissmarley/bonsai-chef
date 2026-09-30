import type { Config, Context } from '@netlify/functions';
import { logout, me, requestCode, verifyCode } from '../lib/auth';
import { createBonsai, deleteBonsai, listBonsai, updateBonsai } from '../lib/bonsai';
import { Router } from '../lib/http';
import { servePhoto, uploadPhoto } from '../lib/photos';
import { publicKey, sendTest, subscribe, unsubscribe } from '../lib/push';
import { createReminder, deleteReminder, listReminders } from '../lib/reminders';
import { createTool, deleteTool, listTools, updateTool } from '../lib/tools';

const router = new Router()
  .on('POST', '/api/auth/request-code', requestCode)
  .on('POST', '/api/auth/verify-code', verifyCode)
  .on('GET', '/api/auth/me', me)
  .on('POST', '/api/auth/logout', logout)
  .on('GET', '/api/bonsai', listBonsai)
  .on('POST', '/api/bonsai', createBonsai)
  .on('PUT', '/api/bonsai/:id', updateBonsai)
  .on('DELETE', '/api/bonsai/:id', deleteBonsai)
  .on('GET', '/api/tools', listTools)
  .on('POST', '/api/tools', createTool)
  .on('PUT', '/api/tools/:id', updateTool)
  .on('DELETE', '/api/tools/:id', deleteTool)
  .on('POST', '/api/photos', uploadPhoto)
  .on('GET', '/api/photos/:id', servePhoto)
  .on('GET', '/api/reminders', listReminders)
  .on('POST', '/api/reminders', createReminder)
  .on('DELETE', '/api/reminders/:id', deleteReminder)
  .on('GET', '/api/push/public-key', publicKey)
  .on('POST', '/api/push/subscribe', subscribe)
  .on('POST', '/api/push/unsubscribe', unsubscribe)
  .on('POST', '/api/push/test', sendTest);

export default (req: Request, context: Context) => router.handle(req, context.ip);

export const config: Config = {
  path: '/api/*',
};
