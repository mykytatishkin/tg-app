import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

const MAX_MESSAGE_LENGTH = 4000;

export class BroadcastMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Сообщение не может быть пустым' })
  @MaxLength(MAX_MESSAGE_LENGTH, {
    message: `Сообщение не должно превышать ${MAX_MESSAGE_LENGTH} символов`,
  })
  message: string;
}
