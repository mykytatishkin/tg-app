import { IsString, IsNotEmpty } from 'class-validator';

export class InstagramAuthDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
