export { IntegratedBrowserService } from './service';
export { executeBrowserVoiceCommand } from './voice-commands';
export { validateBrowserAgentControlRequest } from '../../src/shared/browser-agent-control';
export { createIntegratedBrowserCuDriver } from './cu-driver';
export { BrowserHistoryStore } from './browser-history-store';
export type { BrowserHistoryImportEntry } from './browser-history-store';
export { BrowserHistoryImporter, BrowserHistoryImportRejected, parseHistoryImport, readHistoryImportFile } from './history-importer';
export type { HistoryImportContext, BrowserHistoryImportResult, BrowserHistoryImportSummary } from './history-importer';
export { BrowserCredentialVault } from './credential-vault';
export { BrowserCredentialTransfer, readCredentialTransferFile } from './credential-transfer';
export type { BrowserCredentialImportSummary, BrowserCredentialTransferEntry, PreparedCredentialImport } from './credential-vault';
export { BrowserCredentialError } from './credential-errors';
export { BrowserExtensionManager } from './extension-manager';
export { BrowserReadingModeService } from './reading-mode-service';
export { BrowserDownloadManager, sanitizeDownloadFilename } from './download-manager';
export { BrowserSessionStore, parseBrowserSession } from './session-store';
export { BrowserBookmarkStore } from './bookmark-store';
export { BrowserTrackingRuleEngine, createTrackingRuleList, mitigateFingerprintingRequestHeaders, mitigateFingerprintingResponseHeaders, stripTrackingParameters } from './tracking-protection';
export { BrowserSyncCrypto } from './sync-crypto';
export { BrowserEnterprisePolicyStore, validateEnterprisePolicy } from './enterprise-policy-store';
export { BrowserAgentPolicyStore } from './agent-policy-store';
export { BrowserPrivacyStore } from './privacy-store';
export { checkBrowserNavigation, checkBrowserNavigationLocal } from './safe-navigation';
export type { BrowserNavigationSafetyAction, BrowserNavigationSafetySource, BrowserNavigationSafetyVerdict, BrowserSafeNavigationOptions } from './safe-navigation';
export { readBrowserCapabilityFlags, DEFAULT_BROWSER_CAPABILITY_FLAGS } from './feature-flags';
export type { BrowserCapabilityFlags, BrowserCapabilityKey } from './feature-flags';
export type {
  BrowserAgentPolicyMode,
  BrowserAgentSiteDecision,
  BrowserAgentSitePolicy,
  BrowserBookmark,
  BrowserDownloadRecord,
  BrowserDownloadState,
  BrowserEnterprisePolicy,
  BrowserFindState,
  BrowserPageToolsState,
  BrowserPrivacyCategory,
  BrowserPrivacyLevel,
  BrowserPrivacySiteState,
  BrowserProfileDescriptor,
  BrowserProfileKind,
  BrowserRuntimeDiagnostic,
  BrowserSessionSnapshot,
  BrowserSessionTab,
  BrowserSyncCategory,
  BrowserSyncState,
  BrowserSyncStatus,
  BrowserTabGroup,
  BrowserTabGroupColor,
} from './platform-types';
export type { BrowserReadingSpeechResult, BrowserReadingWordTiming } from './reading-mode-service';
export type { BrowserDocumentContent, BrowserReadingBlock, BrowserReadingContent, BrowserReadingPrepareInput } from './reading-mode-content';
export type {
  BrowserCredentialMetadata,
  BrowserCredentialSaveInput,
  BrowserExtensionMetadata,
  BrowserExtensionInstallPreview,
  BrowserExtensionStatus,
  BrowserHistoryEntry,
  BrowserDomControl,
  BrowserDomSnapshot,
  BrowserElementTargetSummary,
  BrowserInteractionOutcome,
  BrowserObservationSnapshot,
  BrowserObservationStatus,
  IntegratedBrowserNavigateInput,
  IntegratedBrowserOpenInput,
  IntegratedBrowserCaptureResult,
  IntegratedBrowserObservationResult,
  IntegratedBrowserResult,
  IntegratedBrowserState,
  IntegratedBrowserTabState,
  IntegratedBrowserViewport,
  IntegratedBrowserViewMode,
} from './types';
export { describeBlockedUrl, isAllowedBrowserUrl, normalizeBrowserTarget, parseBrowserViewport } from './validation';
export { BrowserSyncError, assertSyncUuid } from './sync-remote';
export { validateSyncControlRequest } from './sync-controller';
export { BrowserAuditError } from './agent-audit-store';
export { validateBrowserShortcutRequest } from '../../src/shared/browser-agent-shortcuts';
