import { IsIn } from 'class-validator';
import { SUGGESTION_STATUSES } from '../entities/suggestion.entity';

export class UpdateSuggestionStatusDto {
  @IsIn(['accepted', 'rejected'])
  status: 'accepted' | 'rejected';
}
