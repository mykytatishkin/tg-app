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
import { GiveawaysService } from './giveaways.service';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { DrawGiveawayDto } from './dto/draw-giveaway.dto';
import { User } from '../auth/entities/user.entity';

@Controller('giveaways')
@UseGuards(JwtAuthGuard)
export class GiveawaysController {
  constructor(private readonly giveawaysService: GiveawaysService) {}

  @Get()
  getGiveaways(
    @Request() req: { user: User },
    @Query('forMaster') forMaster?: string,
  ) {
    const forMasterFlag = forMaster === 'true' || forMaster === '1';
    return this.giveawaysService.getGiveaways(req.user, forMasterFlag);
  }

  @Post()
  @UseGuards(MasterOrAdminGuard)
  createGiveaway(@Request() req: { user: User }, @Body() dto: CreateGiveawayDto) {
    return this.giveawaysService.createGiveaway(req.user, dto);
  }

  @Get(':id/participants')
  @UseGuards(MasterOrAdminGuard)
  getParticipants(@Request() req: { user: User }, @Param('id') id: string) {
    return this.giveawaysService.getParticipants(req.user, id);
  }

  @Get(':id/winners')
  getWinners(@Param('id') id: string) {
    return this.giveawaysService.getWinners(id);
  }

  @Get(':id')
  getGiveaway(@Request() req: { user: User }, @Param('id') id: string) {
    return this.giveawaysService.getGiveaway(req.user, id);
  }

  @Put(':id')
  @UseGuards(MasterOrAdminGuard)
  updateGiveaway(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto: UpdateGiveawayDto,
  ) {
    return this.giveawaysService.updateGiveaway(req.user, id, dto);
  }

  @Delete(':id')
  @UseGuards(MasterOrAdminGuard)
  deleteGiveaway(@Request() req: { user: User }, @Param('id') id: string) {
    return this.giveawaysService.deleteGiveaway(req.user, id);
  }

  @Post(':id/participate')
  participate(@Request() req: { user: User }, @Param('id') id: string) {
    return this.giveawaysService.participate(req.user, id);
  }

  @Post(':id/draw')
  @UseGuards(MasterOrAdminGuard)
  draw(
    @Request() req: { user: User },
    @Param('id') id: string,
    @Body() dto?: DrawGiveawayDto,
  ) {
    return this.giveawaysService.draw(req.user, id, dto);
  }
}
