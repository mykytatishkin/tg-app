import { IsString, IsNumber, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMonthlyExpenseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'yearMonth must be YYYY-MM format' })
  yearMonth: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}
