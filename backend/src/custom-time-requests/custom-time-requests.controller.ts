import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterOrAdminGuard } from '../auth/guards/master-or-admin.guard';
import { CustomTimeRequestsService } from './custom-time-requests.service';
import { CreateCustomTimeRequestDto } from '../crm/dto/create-custom-time-request.dto';
import { User } from '../auth/entities/user.entity';

@Controller('custom-time-requests')
export class CustomTimeRequestsController {
  constructor(private readonly customTimeRequestsService: CustomTimeRequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: User },
    @Body() dto: CreateCustomTimeRequestDto,
  ) {
    return this.customTimeRequestsService.create(req.user, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, MasterOrAdminGuard)
  findAll(
    @Request() req: { user: User },
    @Query('masterId') masterId?: string,
  ) {
    return this.customTimeRequestsService.findAll(req.user, masterId || undefined);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, MasterOrAdminGuard)
  accept(@Request() req: { user: User }, @Param('id') id: string) {
    return this.customTimeRequestsService.accept(req.user, id);
  }

  @Patch(':id/decline')
  @UseGuards(JwtAuthGuard, MasterOrAdminGuard)
  decline(@Request() req: { user: User }, @Param('id') id: string) {
    return this.customTimeRequestsService.decline(req.user, id);
  }
}
