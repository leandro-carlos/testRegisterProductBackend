import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('jwt.accessSecret');
    this.refreshSecret =
      this.configService.getOrThrow<string>('jwt.refreshSecret');
    this.accessExpiresIn = this.configService.getOrThrow<string>(
      'jwt.accessExpiresIn',
    );
    this.refreshExpiresIn = this.configService.getOrThrow<string>(
      'jwt.refreshExpiresIn',
    );
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      username: data.username,
      email: data.email.toLowerCase(),
      passwordHash,
    });
    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, tokens };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email.toLowerCase());

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, tokens };
  }

  async refreshTokens(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!record) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const isTokenValid = await bcrypt.compare(refreshToken, record.tokenHash);

    if (!isTokenValid) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      await this.prisma.refreshToken.delete({
        where: { id: record.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.usersService.findById(payload.sub);
    const tokens = await this.generateTokens(user);

    await this.prisma.refreshToken.delete({
      where: { id: record.id },
    });
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, tokens };
  }

  async logout(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub },
    });

    const matchingToken = await this.findMatchingRefreshToken(
      tokens,
      refreshToken,
    );

    if (!matchingToken) {
      throw new ForbiddenException('Refresh token already revoked');
    }

    await this.prisma.refreshToken.delete({
      where: { id: matchingToken.id },
    });
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        ...this.buildTokenOptions(this.accessExpiresIn),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        ...this.buildTokenOptions(this.refreshExpiresIn),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = this.resolveExpiryDate(this.refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  private buildTokenOptions(expiresIn: string) {
    if (this.isIndefiniteExpiry(expiresIn)) {
      return {};
    }

    return { expiresIn: expiresIn as never };
  }

  private resolveExpiryDate(expiresIn: string) {
    if (this.isIndefiniteExpiry(expiresIn)) {
      return null;
    }

    const value = Number.parseInt(expiresIn.slice(0, -1), 10);
    const unit = expiresIn.slice(-1);
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const multiplier = multipliers[unit];
    if (!multiplier || Number.isNaN(value)) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    return new Date(Date.now() + value * multiplier);
  }

  private isIndefiniteExpiry(expiresIn: string) {
    return ['never', 'none', 'indefinido', 'indefinite'].includes(
      expiresIn.toLowerCase(),
    );
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid');
    }
  }

  private async findMatchingRefreshToken(
    tokens: RefreshToken[],
    refreshToken: string,
  ) {
    for (const token of tokens) {
      const matches = await bcrypt.compare(refreshToken, token.tokenHash);
      if (matches) {
        return token;
      }
    }

    return null;
  }
}
