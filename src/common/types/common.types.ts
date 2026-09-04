import { Request } from 'express';

export interface AuthenticatedUser {
  _id: string;
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  user_role?: string;
  account_id?: string;
  companyID?: string;
  companyName?: string;
  user_status?: string;
  user_profile_img?: string;
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  account_id?: string;
  correlationId?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
