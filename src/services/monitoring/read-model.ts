import { monitoringRepository } from './repository';

export function getActivityLogsByDate(userId: string, date: string) {
  return monitoringRepository.getActivityLogsByDate(userId, date);
}

export function getSessionsByDate(userId: string, date: string) {
  return monitoringRepository.getSessionsByDate(userId, date);
}

export function getDailySummary(userId: string, date: string) {
  return monitoringRepository.getDailySummary(userId, date);
}

export function getActiveSession(userId: string) {
  return monitoringRepository.getActiveSession(userId);
}
