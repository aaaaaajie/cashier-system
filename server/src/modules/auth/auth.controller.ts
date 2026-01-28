import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';

@Controller('/api/v1/admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UsePipes(new CustomValidationPipe())
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}

