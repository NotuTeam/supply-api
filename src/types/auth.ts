export type UserRole = 'superadmin' | 'admin' | 'staff';

export type JwtPayload = {
  sub: number;
  username: string;
  role: UserRole;
};
