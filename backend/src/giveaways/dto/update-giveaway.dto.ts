import { PartialType } from '@nestjs/mapped-types';
import { CreateGiveawayDto } from './create-giveaway.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { GiveawayStatus } from '../entities/giveaway.entity';

export class UpdateGiveawayDto extends PartialType(CreateGiveawayDto) {
  @IsOptional()
  @IsEnum(GiveawayStatus)
  status?: GiveawayStatus;
}
