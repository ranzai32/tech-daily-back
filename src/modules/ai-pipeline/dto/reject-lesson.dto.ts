import { IsString, MinLength } from 'class-validator';

export class RejectLessonDto {
  @IsString()
  @MinLength(1)
  reason: string;
}
