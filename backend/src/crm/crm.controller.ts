import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterOrAdminGuard } from '../auth/guards/master-or-admin.guard';
import { CrmService } from './crm.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UpsertMonthlyExpenseDto } from './dto/upsert-monthly-expense.dto';
import { User } from '../auth/entities/user.entity';

@Controller('crm')
@UseGuards(JwtAuthGuard, MasterOrAdminGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Get('masters')
  getMasters(@Request() req: { user: User }) {
    return this.crmService.getMasters(req.user);
  }

  @Get('clients')
  getClients(
    @Request() req: { user: User },
    @Query('masterId') masterId?: string,
  ) {
    return this.crmService.getClients(req.user, masterId || undefined);
  }

  @Post('clients')
  createClient(@Request() req: { user: User }, @Body() dto: CreateClientDto) {
    return this.crmService.createClient(req.user, dto);
  }

  @Get('stats')
  getStats(
    @Request() req: { user: User },
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('masterId') masterId?: string,
  ) {
    return this.crmService.getStats(req.user, year, month, masterId || undefined);
  }

  @Get('expenses')
  getExpenses(
    @Request() req: { user: User },
    @Query('yearMonth') yearMonth?: string,
    @Query('masterId') masterId?: string,
  ) {
    return this.crmService.getExpenses(req.user, yearMonth, masterId || undefined);
  }

  @Put('expenses/:yearMonth')
  upsertExpense(
    @Request() req: { user: User },
    @Param('yearMonth') yearMonth: string,
    @Body() dto: UpsertMonthlyExpenseDto,
  ) {
    return this.crmService.upsertExpense(req.user, yearMonth, dto);
  }

  @Get('clients/:id')
  getClient(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.getClient(req.user, id);
  }

  @Put('clients/:id')
  updateClient(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.crmService.updateClient(req.user, id, dto);
  }

  @Post('clients/:id/send-reminder')
  sendReminderToClient(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() body: { type?: string },
  ) {
    const type = body?.type === 'smart' ? 'smart' : 'simple';
    return this.crmService.sendReminderToClient(req.user, id, type);
  }

  @Delete('clients/:id')
  deleteClient(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.deleteClient(req.user, id);
  }

  @Get('services')
  getServices(
    @Request() req: { user: User },
    @Query('masterId') masterId?: string,
  ) {
    return this.crmService.getServices(req.user, masterId || undefined);
  }

  @Post('services')
  createService(@Request() req: { user: User }, @Body() dto: CreateServiceDto) {
    return this.crmService.createService(req.user, dto);
  }

  @Get('services/:id')
  getService(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.getService(req.user, id);
  }

  @Put('services/:id')
  updateService(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.crmService.updateService(req.user, id, dto);
  }

  @Delete('services/:id')
  deleteService(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.deleteService(req.user, id);
  }

  @Get('availability')
  getAvailability(
    @Request() req: { user: User },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('masterId') masterId?: string,
  ) {
    return this.crmService.getAvailability(req.user, from, to, masterId || undefined);
  }

  @Post('availability')
  createAvailability(
    @Request() req: { user: User },
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.crmService.createAvailability(req.user, dto);
  }

  @Put('availability/:id')
  updateAvailability(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.crmService.updateAvailability(req.user, id, dto);
  }

  @Delete('availability/:id')
  deleteAvailability(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.deleteAvailability(req.user, id);
  }

  @Get('appointments')
  getAppointments(
    @Request() req: { user: User },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('upcomingOnly') upcomingOnly?: string,
    @Query('masterId') masterId?: string,
  ) {
    return this.crmService.getAppointments(
      req.user,
      from,
      to,
      upcomingOnly === 'true' || upcomingOnly === '1',
      masterId || undefined,
    );
  }

  @Post('appointments')
  createAppointment(
    @Request() req: { user: User },
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.crmService.createAppointment(req.user, dto);
  }

  @Get('appointments/:id')
  getAppointment(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.getAppointment(req.user, id);
  }

  @Put('appointments/:id')
  updateAppointment(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.crmService.updateAppointment(req.user, id, dto);
  }

  @Delete('appointments/:id')
  deleteAppointment(@Request() req: { user: User }, @Param('id') id: string) {
    return this.crmService.deleteAppointment(req.user, id);
  }
}
