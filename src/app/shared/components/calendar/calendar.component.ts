import {
  ChangeDetectorRef,
  Component,
  Input,
  signal,
  SimpleChanges,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CalendarOptions, EventApi, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { FullCalendarComponent } from '@fullcalendar/angular';
import { Router } from '@angular/router';
import { AppointmentEvent } from '../../../interfaces/interview-scheduling/interview.interface';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements AfterViewInit {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  @Input() events: AppointmentEvent[] = [];
  @Input() DateSelected: string = '';

  currentEvents = signal<EventApi[]>([]);
  private isCalendarReady = false;

  calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    headerToolbar: {
      start: 'title',
      end: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
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
      setTimeout(() => {
        this.gotoDate(this.DateSelected);
      });
    }
  }


  ngOnChanges(changes: SimpleChanges) {
    if (changes['events'] && changes['events'].currentValue !== changes['events'].previousValue) {
      const mappedEvents = this.events.map(e => {
        const { type, title } = this.getEventType(e);
        return {
          title,
          start: this.combineDateTime(e.date, e.time),
          classNames: [type],
          interview: e.interview,
          userId: e.userId
        };
      });

      if (this.calendarComponent) {
        const calendarApi = this.calendarComponent.getApi();
        calendarApi.removeAllEvents();
        calendarApi.addEventSource(mappedEvents);
      } else {
        console.warn('CalendarComponent not ready to update events');
      }
    }

    if (changes['DateSelected'] && this.isCalendarReady && this.calendarComponent) {
      this.gotoDate(this.DateSelected);
    }
  }


  getEventType(event: AppointmentEvent): { type: string, title: string } {
    const teamPart = event.teamName ? `(${event.teamName}) ` : '';
    let title = `${teamPart}${event.time} ${event.userName}`;

    // if (event.status === "No Show") {
    //   return { type: 'strikethrough-dashed', title };
    // }

    switch (Number(event.interview)) {
      case 1:
        if (event.status === "No Show") {
          return { type: 'event-interview1 strikethrough-dashed', title };
        } else if (event.status.includes('Decline')) {
          return { type: 'event-interview1 event-decline', title };
        } else {
          return { type: 'event-interview1', title };
        }
      case 2:
        if (event.status === "No Show") {
          return { type: 'event-interview2 strikethrough-dashed', title };
        } else if (event.status.includes('Decline')) {
          return { type: 'event-interview2 event-decline', title };
        } else {
          return { type: 'event-interview2', title };
        }
      case 3:
        if (event.status === "No Show") {
          return { type: 'event-onboard strikethrough-dashed', title: event.userName };
        } else if (event.status.includes('Decline')) {
          return { type: 'event-onboard event-decline', title: event.userName };
        } else {
          return { type: 'event-onboard', title: event.userName };
        }
        break;
    }

    return { type: '', title };
  }


  private combineDateTime(date: string, time: string): string {
    return `${date}T${time}`;
  }

  handleEventClick(clickInfo: EventClickArg) {
    const eventInterviewType = clickInfo.event.extendedProps?.['interview'];
    const eventUserID = clickInfo.event.extendedProps?.['userId']

    console.log(clickInfo.event.extendedProps, '=>clickInfo.event.extendedProps')

    // if (eventInterviewType === 1) {
    //   this.router.navigate(['/interview-scheduling/interview-round-1']);
    //   console.log('Navigating to Interview Round 1');
    // } else if (eventInterviewType === 2) {
    //   this.router.navigate(['/interview-scheduling/interview-round-2']);
    //   console.log('Navigating to Interview Round 2');
    // } else if (eventInterviewType === 3) {
    //   this.router.navigate(['/offer-employment']);
    //   console.log('Navigating to Offer Employment');
    // }

    const queryParams = {
      id: eventUserID,
      interview: eventInterviewType
    }
    this.router.navigate(['/interview-scheduling/interview-form/details'], { queryParams });
  }

  gotoDate(dateStr: string) {
    try {
      if (!this.calendarComponent) return;

      const calendarApi = this.calendarComponent.getApi();
      calendarApi.gotoDate(dateStr);
    } catch (e) {
      console.warn('Calendar not ready yet.');
    }
  }

}
