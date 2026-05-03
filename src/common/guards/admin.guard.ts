import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { email?: string } }>();
    const email = req.user?.email;
    const allowed = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.length) {
      throw new ForbiddenException('ADMIN_EMAILS is not configured');
    }
    if (email && allowed.includes(email.toLowerCase())) {
      return true;
    }
    throw new ForbiddenException();
  }
}
