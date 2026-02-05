import { IsString, IsOptional, IsNotEmpty, MaxLength, Matches } from 'class-validator';

/** YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** HH:mm or HH:mm:ss */
const TIME_REGEX = /^\d{1,2}:\d{2}(:\d{2})?$/;

export class CreateCustomTimeRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Выберите мастера' })
  masterId: string;

  @IsString()
  @IsNotEmpty({ message: 'Выберите услугу' })
  serviceId: string;

  @IsString()
  @IsNotEmpty({ message: 'Укажите дату' })
  @Matches(DATE_REGEX, { message: 'Формат даты: ГГГГ-ММ-ДД' })
  requestedDate: string;

  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'Формат времени: ЧЧ:ММ' })
  requestedStartTime?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}
