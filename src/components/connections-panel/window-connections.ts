import type { CalendarBridge } from '../../shared/calendar';
export {};

declare global {
  interface Window {
    calendar?: CalendarBridge;
  }
}
