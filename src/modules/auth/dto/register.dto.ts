import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { SkillLevel } from '../../../common/enums/skill-level.enum';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(SkillLevel)
  skill_level: SkillLevel;
}
