import { Controller, Get, Post, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionTier, SubscriptionStatus } from './entities/master-subscription.entity';
import { User } from '../auth/entities/user.entity';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /** Master: get own subscription status. */
  @Get('mine')
  getMine(@Request() req: { user: User }) {
    if (!req.user.isMaster && !req.user.isAdmin) throw new ForbiddenException();
    return this.subscriptionsService.getForMaster(req.user.id);
  }

  /** Admin: list all master subscriptions. */
  @Get()
  listAll(@Request() req: { user: User }) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.subscriptionsService.listAll();
  }

  /** Admin: set or extend subscription for a master. */
  @Post(':masterId')
  upsert(
    @Request() req: { user: User },
    @Param('masterId') masterId: string,
    @Body() body: { tier: SubscriptionTier; months: number },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.subscriptionsService.upsert(masterId, body.tier, body.months ?? 1);
  }

  /** Admin: suspend or reactivate. */
  @Post(':masterId/status')
  setStatus(
    @Request() req: { user: User },
    @Param('masterId') masterId: string,
    @Body() body: { status: SubscriptionStatus },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    return this.subscriptionsService.setStatus(masterId, body.status);
  }
}
