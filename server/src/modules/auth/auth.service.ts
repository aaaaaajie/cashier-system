import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async validateAdmin(username: string, password: string): Promise<boolean> {
    const adminUsername = this.configService.get<string>('admin.username') ?? 'admin';
    if (username !== adminUsername) return false;

    const passwordHash = this.configService.get<string>('admin.passwordHash');
    if (passwordHash) {
      return bcrypt.compare(password, passwordHash);
    }

    const adminPassword = this.configService.get<string>('admin.password') ?? '';
    return password === adminPassword;
  }

  async login(username: string, password: string) {
    const ok = await this.validateAdmin(username, password);
    if (!ok) {
      throw new HttpException({ code: 10001, message: '用户名或密码错误' }, HttpStatus.UNAUTHORIZED);
    }

    const token = await this.jwtService.signAsync({ sub: username });
    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '24h',
    };
  }
}

