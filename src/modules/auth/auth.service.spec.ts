import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { SkillLevel } from '../../common/enums/skill-level.enum';
import { User } from '../users/user.entity';

const mockUser: User = {
  id: 'uuid-1',
  email: 'test@example.com',
  passwordHash: '',
  skillLevel: SkillLevel.Beginner,
  fullName: null,
  notificationFrequency: 'daily',
  notificationTime: '09:00',
  streakVisible: true,
  fcmToken: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked.jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('returns a bcrypt hash', async () => {
      const hash = await service.hashPassword('mypassword');
      expect(hash).not.toBe('mypassword');
      const valid = await bcrypt.compare('mypassword', hash);
      expect(valid).toBe(true);
    });

    it('produces different hashes for the same input', async () => {
      const hash1 = await service.hashPassword('same');
      const hash2 = await service.hashPassword('same');
      expect(hash1).not.toBe(hash2);
    });

    it('uses 10 rounds (hash length ~60 chars)', async () => {
      const hash = await service.hashPassword('password123');
      expect(hash.length).toBeGreaterThanOrEqual(59);
    });
  });

  describe('validateUser', () => {
    it('returns user when credentials are correct', async () => {
      const passwordHash = await bcrypt.hash('correct', 10);
      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser, passwordHash });

      const result = await service.validateUser('test@example.com', 'correct');
      expect(result).toBeDefined();
      expect(result!.email).toBe('test@example.com');
    });

    it('returns null when password is wrong', async () => {
      const passwordHash = await bcrypt.hash('correct', 10);
      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser, passwordHash });

      const result = await service.validateUser('test@example.com', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nobody@example.com', 'pass');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('returns access_token and user on success', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(mockUser);

      const result = await service.register(
        'test@example.com',
        'password123',
        SkillLevel.Beginner,
      );

      expect(result.access_token).toBe('mocked.jwt.token');
      expect(result.user.email).toBe('test@example.com');
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('throws ConflictException when email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register('test@example.com', 'password123', SkillLevel.Beginner),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns access_token and user on success', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser, passwordHash });

      const result = await service.login('test@example.com', 'password123');

      expect(result.access_token).toBe('mocked.jwt.token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct', 10);
      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser, passwordHash });

      await expect(
        service.login('test@example.com', 'wrong'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('ghost@example.com', 'pass'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
