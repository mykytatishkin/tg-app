import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';
import { SUGGESTION_CATEGORIES } from '../entities/suggestion.entity';

const MAX_TEXT_LENGTH = 2000;

export class CreateSuggestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Введите текст предложения' })
  @MaxLength(MAX_TEXT_LENGTH, {
    message: `Текст не должен превышать ${MAX_TEXT_LENGTH} символов`,
  })
  text: string;

  @IsString()
  @IsNotEmpty({ message: 'Выберите категорию' })
  @IsIn(SUGGESTION_CATEGORIES, { message: 'Недопустимая категория' })
  category: string;
}
