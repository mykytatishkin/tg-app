import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertMonthlyExpenseDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}
