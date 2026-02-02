import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import { BookAppointmentDto } from '../crm/dto/book-appointment.dto';
import { User } from '../auth/entities/user.entity';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('masters')
  getMasters() {
    return this.appointmentsService.getMasters();
  }

  @Get('services')
  getServices(@Query('masterId') masterId?: string) {
    return this.appointmentsService.getServices(masterId);
  }

  @Get('mine')
  getMine(@Request() req: { user: User }) {
    return this.appointmentsService.getMine(req.user);
  }

  @Get('available-slots')
  getAvailableSlots(
    @Query('serviceId') serviceId: string,
    @Query('masterId') masterId: string,
    @Query('date') date: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!serviceId) {
      throw new BadRequestException('serviceId is required');
    }
    if (from && to) {
      return this.appointmentsService.getAvailableSlotsInRange(serviceId, from, to, masterId);
    }
    if (date) {
      return this.appointmentsService.getAvailableSlots(date, serviceId, masterId);
    }
    throw new BadRequestException('either date or (from and to) are required');
  }

  @Post('book')
  book(@Request() req: { user: User }, @Body() dto: BookAppointmentDto) {
    return this.appointmentsService.book(req.user, dto);
  }

  @Post(':id/reminder')
  setReminder(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() body: { enable: boolean },
  ) {
    return this.appointmentsService.setReminder(req.user, id, body?.enable === true);
  }

  @Post(':id/cancel')
  cancelByClient(@Request() req: { user: User }, @Param('id') id: string) {
    return this.appointmentsService.cancelByClient(req.user, id);
  }
}
