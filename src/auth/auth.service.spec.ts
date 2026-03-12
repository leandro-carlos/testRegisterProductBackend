import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../database/prisma.service';
import { createUserEntity } from '../../test/helpers';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let prismaService: {
    refreshToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    prismaService = {
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const configService = {
      getOrThrow: jest
        .fn()
        .mockImplementation((key: string) => {
          const values: Record<string, string> = {
            'jwt.accessSecret': 'access-secret',
            'jwt.refreshSecret': 'refresh-secret',
            'jwt.accessExpiresIn': 'never',
            'jwt.refreshExpiresIn': 'never',
          };

          return values[key];
        }),
    } as unknown as ConfigService;

    service = new AuthService(
      usersService,
      prismaService as unknown as PrismaService,
      jwtService,
      configService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user and stores refresh token', async () => {
    const user = createUserEntity();
    (bcrypt.hash as jest.Mock)
      .mockResolvedValueOnce('password-hash')
      .mockResolvedValueOnce('refresh-token-hash');
    usersService.create.mockResolvedValue(user);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.register({
      username: 'leandro',
      email: 'leandro@example.com',
      password: 'StrongPassword123',
    });

    expect(usersService.create).toHaveBeenCalledWith({
      username: 'leandro',
      email: 'leandro@example.com',
      passwordHash: 'password-hash',
    });
    expect(prismaService.refreshToken.create).toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(1, expect.any(Object), {
      secret: 'access-secret',
    });
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(2, expect.any(Object), {
      secret: 'refresh-secret',
    });
    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.user.email).toBe('leandro@example.com');
  });

  it('throws for invalid credentials', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login('wrong@example.com', 'StrongPassword123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshes tokens when refresh token is valid', async () => {
    const user = createUserEntity();
    const storedToken = {
      id: 'token-1',
      userId: user.id,
      tokenHash: 'stored-hash',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jwtService.verifyAsync.mockResolvedValue({
      sub: user.id,
      email: user.email,
      username: user.username,
    });
    prismaService.refreshToken.findFirst.mockResolvedValue(storedToken);
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    usersService.findById.mockResolvedValue(user);
    jwtService.signAsync
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');
    (bcrypt.hash as jest.Mock).mockResolvedValue('new-refresh-hash');

    const result = await service.refreshTokens('valid-refresh-token');

    expect(prismaService.refreshToken.delete).toHaveBeenCalledWith({
      where: { id: storedToken.id },
    });
    expect(result.tokens.refreshToken).toBe('new-refresh');
  });
});
