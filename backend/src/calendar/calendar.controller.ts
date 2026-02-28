import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  /** Public endpoint — authenticated only by the secret token embedded in the URL. */
  @Get('feed/:token.ics')
  async getFeed(@Param('token') token: string, @Res() res: Response) {
    const icsContent = await this.calendarService.buildIcsFeed(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="appointments.ics"');
    res.send(icsContent);
  }
}
