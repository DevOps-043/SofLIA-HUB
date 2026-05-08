import { getAllSessions, getSession, removeSession } from '../sessions';
import type { WhatsAppSession } from '../types';

export function getWhatsAppSession(phoneNumber: string): WhatsAppSession | null {
  return getSession(phoneNumber);
}

export function logoutWhatsAppUser(phoneNumber: string): boolean {
  return removeSession(phoneNumber);
}

export function getAllWhatsAppSessions(): WhatsAppSession[] {
  return getAllSessions();
}
