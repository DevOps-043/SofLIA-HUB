import { nativeConfirmation } from '../ipc/caller-authorization';

export { trustedAppCaller as calendarCaller, IPC_APPROVAL_MS as CALENDAR_APPROVAL_MS } from '../ipc/caller-authorization';
export function calendarConfirmation() { return nativeConfirmation('Confirmar cambio en calendario'); }
