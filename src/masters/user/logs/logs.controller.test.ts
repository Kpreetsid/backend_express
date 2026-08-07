import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logs.service', () => ({
  userLogsService: {
    getAllUserLogs: vi.fn()
  }
}));

vi.mock('../../../utils/helper', () => ({
  helperService: {
    validateObjectId: vi.fn((value: string) => `validated:${value}`)
  }
}));

import { userLogsController } from './logs.controller';
import { userLogsService } from './logs.service';
import { helperService } from '../../../utils/helper';

const response = () => {
  const res: any = {
    status: vi.fn(),
    json: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

describe('user audit-log access boundary', () => {
  beforeEach(() => {
    vi.mocked(userLogsService.getAllUserLogs).mockReset().mockResolvedValue([
      { _id: 'log-a' }
    ]);
    vi.mocked(helperService.validateObjectId).mockClear();
  });

  it('pins a non-admin log query to the authenticated user', async () => {
    const req: any = {
      user: {
        account_id: 'tenant-a',
        _id: 'user-a',
        user_role: 'technician'
      },
      query: {
        userId: 'user-b',
        statusCode: '403'
      }
    };
    const res = response();
    const next = vi.fn();

    await userLogsController.userLogs(req, res, next);

    expect(userLogsService.getAllUserLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'tenant-a',
        userId: 'user-a',
        statusCode: '403'
      })
    );
    expect(helperService.validateObjectId).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an admin to filter only inside the authenticated tenant', async () => {
    const req: any = {
      user: {
        account_id: 'tenant-a',
        _id: 'admin-a',
        user_role: 'admin'
      },
      query: { userId: 'user-b' }
    };
    const res = response();
    const next = vi.fn();

    await userLogsController.userLogs(req, res, next);

    expect(userLogsService.getAllUserLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'tenant-a',
        userId: 'validated:user-b'
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid dates and reports empty tenant-scoped results', async () => {
    const invalidDateReq: any = {
      user: {
        account_id: 'tenant-a',
        _id: 'user-a',
        user_role: 'technician'
      },
      query: { fromDate: 'not-a-date' }
    };
    const next = vi.fn();

    await userLogsController.userLogs(invalidDateReq, response(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, message: 'Invalid date format' })
    );

    vi.mocked(userLogsService.getAllUserLogs).mockResolvedValueOnce([]);
    next.mockClear();
    await userLogsController.userLogs({
      user: {
        account_id: 'tenant-a',
        _id: 'user-a',
        user_role: 'technician'
      },
      query: {}
    } as any, response(), next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 404, message: 'Log data not found' })
    );
  });
});
