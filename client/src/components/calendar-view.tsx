import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import type { Service, BookingWithDetails, Availability } from "@shared/schema";

export interface ScheduleClickEvent {
  schedule: Availability;
  date: Date;
  isRecurring: boolean;
}

interface CalendarViewProps {
  services?: Service[];
  bookings?: BookingWithDetails[];
  schedules?: Availability[];
  onDateClick?: (date: Date) => void;
  onScheduleClick?: (event: ScheduleClickEvent) => void;
  userTimezone?: string;
}

export default function CalendarView({ 
  services = [], 
  bookings = [], 
  schedules = [],
  onDateClick,
  onScheduleClick,
  userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const eventsByDate = useMemo(() => {
    const events: Record<string, { bookings: BookingWithDetails[], schedules: Availability[] }> = {};

    bookings.forEach(booking => {
      const dateKey = format(new Date(booking.scheduledDate), 'yyyy-MM-dd');
      if (!events[dateKey]) events[dateKey] = { bookings: [], schedules: [] };
      events[dateKey].bookings.push(booking);
    });

    const inactiveSpecificDates = new Set<string>();
    schedules.forEach(schedule => {
      if (schedule.scheduleType === 'specific' && schedule.specificDate) {
        const dateKey = format(new Date(schedule.specificDate), 'yyyy-MM-dd');
        if (schedule.isActive === false) {
          inactiveSpecificDates.add(dateKey);
        } else {
          if (!events[dateKey]) events[dateKey] = { bookings: [], schedules: [] };
          events[dateKey].schedules.push(schedule);
        }
      }
    });

    const recurringSchedules = schedules.filter(s => s.scheduleType === 'recurring' && s.daysOfWeek && s.isActive !== false);
    daysInMonth.forEach(day => {
      const dayOfWeek = day.getDay();
      const dateKey = format(day, 'yyyy-MM-dd');
      
      if (inactiveSpecificDates.has(dateKey)) return;
      
      recurringSchedules.forEach(schedule => {
        const scheduleDays = schedule.daysOfWeek as number[];
        if (scheduleDays.includes(dayOfWeek)) {
          if (!events[dateKey]) events[dateKey] = { bookings: [], schedules: [] };
          if (!events[dateKey].schedules.some(s => s.id === schedule.id)) {
            events[dateKey].schedules.push(schedule);
          }
        }
      });
    });

    return events;
  }, [bookings, schedules, daysInMonth]);

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const handleScheduleClick = (e: React.MouseEvent, schedule: Availability, day: Date) => {
    e.stopPropagation();
    onScheduleClick?.({
      schedule,
      date: day,
      isRecurring: schedule.scheduleType === 'recurring',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5" />
            <span>Calendar</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreviousMonth}
              data-testid="button-previous-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-xs text-neutral-500 mt-2">
          <Clock className="w-3 h-3" />
          <span>Timezone: {userTimezone}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-neutral-600 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: monthStart.getDay() }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}

          {daysInMonth.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate[dateKey];
            const hasEvents = dayEvents && (dayEvents.bookings.length > 0 || dayEvents.schedules.length > 0);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dateKey}
                className={`
                  aspect-square p-1 border rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors
                  ${isToday ? 'border-blue-500 bg-blue-50' : 'border-neutral-200'}
                  ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}
                `}
                onClick={() => onDateClick?.(day)}
                data-testid={`calendar-day-${dateKey}`}
              >
                <div className="text-xs font-semibold text-center mb-1">
                  {format(day, 'd')}
                </div>
                {hasEvents && (
                  <div className="space-y-0.5">
                    {dayEvents.bookings.slice(0, 2).map((booking, idx) => (
                      <div
                        key={`booking-${booking.id}-${idx}`}
                        className={`text-[10px] px-1 rounded truncate ${getStatusColor(booking.status || 'pending')}`}
                        title={`${booking.service?.name || 'Booking'} - ${booking.status}`}
                      >
                        {booking.service?.name?.substring(0, 10) || 'Booking'}
                      </div>
                    ))}
                    {dayEvents.schedules
                      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                      .slice(0, Math.max(0, 3 - dayEvents.bookings.length))
                      .map((schedule, idx) => (
                      <div
                        key={`schedule-${schedule.id}-${idx}`}
                        className={`text-[10px] px-1 rounded truncate bg-purple-100 text-purple-800 ${onScheduleClick ? 'hover:bg-purple-200 hover:ring-1 hover:ring-purple-400 cursor-pointer' : ''}`}
                        title={`Available: ${schedule.startTime} - ${schedule.endTime} (click to edit)`}
                        onClick={(e) => handleScheduleClick(e, schedule, day)}
                        data-testid={`schedule-event-${schedule.id}-${dateKey}`}
                      >
                        {schedule.startTime?.substring(0, 5)}-{schedule.endTime?.substring(0, 5)}
                      </div>
                    ))}
                    {(dayEvents.bookings.length + dayEvents.schedules.length) > 3 && (
                      <div className="text-[10px] text-center text-neutral-500">
                        +{dayEvents.bookings.length + dayEvents.schedules.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-green-100" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-yellow-100" />
            <span>Pending</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-purple-100" />
            <span>Available (click to edit)</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-blue-100" />
            <span>Completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
