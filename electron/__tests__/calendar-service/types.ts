import type { CalendarService } from '../../calendar-service';

export type CalendarServiceTestContext = {
  getService: () => CalendarService;
};
