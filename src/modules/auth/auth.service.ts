import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { SkillLevel } from '../../common/enums/skill-level.enum';
import {
  AuthResponseDto,
  UserResponseDto,
} from './dto/user-response.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async register(
    email: string,
    password: string,
    skillLevel: SkillLevel,
  ): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await this.hashPassword(password);
    const user = await this.usersService.create({ email, passwordHash, skillLevel });
    return this.buildResponse(user);
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.buildResponse(user);
  }

  private buildResponse(user: User): AuthResponseDto {
    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email }),
      user: UserResponseDto.from(user),
    };
  }
}
