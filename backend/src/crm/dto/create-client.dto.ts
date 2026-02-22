import { IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  telegramId?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  instagram?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Invisible nickname — only master sees it. */
  @IsString()
  @IsOptional()
  masterNickname?: string;

  /** Постоянный клиент: получает оповещение о новых слотах со скидкой на час раньше. */
  @IsBoolean()
  @IsOptional()
  notifyAboutNewSlots?: boolean;
}
