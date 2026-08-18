import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UsersService } from '../../users/users.service';
import { User } from '../../entities/user.entity';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { SECRETS } from '../../config/env';

export interface JwtPayload {
  sub: number;
  sid?: string;
}

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(JwtStrategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: SECRETS.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findByIdWithSessionToken(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (payload.sid && user.sessionToken && payload.sid !== user.sessionToken) {
      throw new UnauthorizedException('Session expired due to login on another device');
    }
    return user;
  }
}
