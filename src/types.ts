export type Profile = {
  name: string;
  course: string;
  photoUri?: string;
  notificationsEnabled: boolean;
  nightBeforeEnabled: boolean;
  nightBeforeTime: string; // "HH:mm"
  sameDayMinutesBefore: number; // minutes before startTime, 0 = disabled
};

export type StudyLocation = {
  id: string;
  name: string;
  address?: string;
  color: string;
  notes?: string;
};

export type Module = {
  id: string;
  name: string; // e.g. "UE 1"
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
  color: string;
};

export type ScheduleEntry = {
  id: string;
  startDate: string; // ISO yyyy-mm-dd — first day the activity happens
  endDate: string; // ISO yyyy-mm-dd — last day the activity happens (same as startDate for a single-day activity)
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  title: string;
  locationId?: string;
  moduleId?: string;
  notes?: string;
  nightBeforeNotificationId?: string;
  sameDayNotificationId?: string;
};
