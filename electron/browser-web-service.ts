import { EventEmitter } from 'node:events';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { attachBrowserWebEngine } from './browser-web/service-engine';
import { attachBrowserWebLifecycle } from './browser-web/service-lifecycle';
import { attachBrowserWebProfiles } from './browser-web/service-profiles';
import { attachBrowserWebRuntime } from './browser-web/service-runtime';
import type {
  BrowserWebEngineApi,
  BrowserWebLifecycleApi,
  BrowserWebProfileApi,
  BrowserWebRuntimeApi,
  PlaywrightModule,
} from './browser-web/service-types';
import type {
  BrowserProfileMode,
  BrowserQueueEntry,
  BrowserTaskStatus,
} from './browser-web/types';

export class BrowserWebService extends EventEmitter {
  declare setApiKey: BrowserWebLifecycleApi['setApiKey'];
  declare getStatus: BrowserWebLifecycleApi['getStatus'];
  declare isRunning: BrowserWebLifecycleApi['isRunning'];
  declare abortAll: BrowserWebLifecycleApi['abortAll'];
  declare processQueue: BrowserWebLifecycleApi['processQueue'];

  apiKey = '';
  genAI: GoogleGenerativeAI | null = null;
  playwright: PlaywrightModule | null = null;
  browser: any = null;
  context: any = null;
  page: any = null;
  status: BrowserTaskStatus = 'idle';
  currentTask: string | null = null;
  currentStep = 0;
  currentMaxSteps = 0;
  currentUrl: string | null = null;
  currentProfileId: string | null = null;
  currentProfileMode: BrowserProfileMode | null = null;
  lastAction: string | null = null;
  lastVerification: string | null = null;
  lastTracePath: string | null = null;
  lastReportPath: string | null = null;
  lastScreenshotPath: string | null = null;
  abortController: AbortController | null = null;
  queue: BrowserQueueEntry[] = [];
}

export interface BrowserWebService
  extends BrowserWebLifecycleApi,
    BrowserWebProfileApi,
    BrowserWebRuntimeApi,
    BrowserWebEngineApi {}

attachBrowserWebLifecycle(BrowserWebService);
attachBrowserWebProfiles(BrowserWebService);
attachBrowserWebRuntime(BrowserWebService);
attachBrowserWebEngine(BrowserWebService);
