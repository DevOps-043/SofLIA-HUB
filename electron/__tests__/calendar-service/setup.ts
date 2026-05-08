import './mocks';
import { CalendarService } from '../../calendar-service';
export { mockExistsSync, mockReadFileSync } from './mocks';

export function createCalendarService(): CalendarService {
  const service = new CalendarService();
  service.setConfig({ google: { clientId: 'test-cid', clientSecret: 'test-cs' } });
  service.setUserId('user-123');
  return service;
}
