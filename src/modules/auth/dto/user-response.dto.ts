import { SkillLevel } from '../../../common/enums/skill-level.enum';

export class UserResponseDto {
  id: string;
  email: string;
  skillLevel: SkillLevel;
  fullName: string | null;
  createdAt: Date;
  updatedAt: Date;

  static from(user: {
    id: string;
    email: string;
    skillLevel: SkillLevel;
    fullName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.skillLevel = user.skillLevel;
    dto.fullName = user.fullName;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}

export class AuthResponseDto {
  access_token: string;
  user: UserResponseDto;
}
