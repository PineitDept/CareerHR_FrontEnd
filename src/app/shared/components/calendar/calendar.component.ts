import {
  ChangeDetectorRef,
  Component,
  Input,
  signal,
  SimpleChanges,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import interactionPlugin from '@fullcalendar/interaction';
import { CalendarOptions, EventApi, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { Router } from '@angular/router';

type EventItem = {
  user: string;
  teamId?: number;
  teamName?: string;
  time: string;
  date: string;
  classNames?: string[];
  interview: string;
  status?: string;
};

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements AfterViewInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  @Input() events: EventItem[] = [];
  @Input() DateSelected: string = '';

  currentEvents = signal<EventApi[]>([]);
  private isCalendarReady = false;

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    headerToolbar: {
      start: 'title',
      end: ''
    },
    plugins: [dayGridPlugin, interactionPlugin],
    events: [],
    eventClick: this.handleEventClick.bind(this),
  };

  constructor(
    private changeDetector: ChangeDetectorRef,
    private router: Router,
  ) { }

  ngAfterViewInit() {
    this.isCalendarReady = true;
    if (this.DateSelected) {
      this.gotoDate(this.DateSelected);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['events']) {
      const mappedEvents = this.events.map(e => {
        const teamPart = e.teamName ? `(${e.teamName}) ` : '';
        let titleEvent = `${teamPart}${e.time} ${e.user}`;
        let eventType = '';

        if (e.status === 'rescheduled') {
          eventType = 'event-cancel';
        } else if (e.interview === 'interview1') {
          eventType = 'event-interview1';
        } else if (e.interview === 'interview2') {
          eventType = 'event-interview2';
        } else if (e.interview === 'onboarded') {
          eventType = 'event-onboard';
          titleEvent = e.user;
        }

        return {
          title: titleEvent,
          start: this.combineDateTime(e.date, e.time),
          classNames: [eventType],
          interview: e.interview
        };
      });

      this.calendarOptions = {
        ...this.calendarOptions,
        events: mappedEvents
      };
    }

    if (changes['DateSelected'] && this.isCalendarReady) {
      this.gotoDate(this.DateSelected);
    }
  }

  private combineDateTime(date: string, time: string): string {
    return `${date}T${time}`;
  }

  handleEventClick(clickInfo: EventClickArg) {
    const eventInterviewType = clickInfo.event.extendedProps?.['interview'];

    console.log(clickInfo.event, '=>eventInterviewType: ', eventInterviewType);

    if (eventInterviewType === 'interview1') {
      this.router.navigate(['/interview-scheduling/interview-round-1']);
      console.log('Navigating to Interview Round 1');
    } else if (eventInterviewType === 'interview2') {
      this.router.navigate(['/interview-scheduling/interview-round-2']);
      console.log('Navigating to Interview Round 2');
    } else if (eventInterviewType === 'onboarded') {
      this.router.navigate(['/offer-employment']);
      console.log('Navigating to Offer Employment');
    }
  }

  gotoDate(dateStr: string) {
    try {
      const calendarApi = this.calendarComponent.getApi();
      calendarApi.gotoDate(dateStr);
    } catch (e) {
      console.warn('Calendar not ready yet.');
    }
  }
}
