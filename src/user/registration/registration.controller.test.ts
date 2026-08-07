import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registrationController } from './registration.controller';
import { registrationService } from './registration.service';
import { usersService } from '../../masters/user/user.service';
import { companyService } from '../../masters/company/company.service';

vi.mock('./registration.service', () => ({
  registrationService: {
    emailVerificationCode: vi.fn(),
    verifyOTPCode: vi.fn()
  }
}));

vi.mock('../../masters/user/user.service', () => ({
  usersService: {
    getAllUsers: vi.fn()
  }
}));

vi.mock('../../masters/company/company.service', () => ({
  companyService: {
    getAllCompanies: vi.fn()
  }
}));

describe('public registration controller', () => {
  const registrationBody = {
    email: 'owner@example.com',
    username: 'owner',
    firstName: 'Pat',
    account_name: 'Example Plant'
  };

  const makeResponse = () => {
    const response: any = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    response.json.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersService.getAllUsers).mockResolvedValue([]);
    vi.mocked(companyService.getAllCompanies).mockResolvedValue([]);
    vi.mocked(registrationService.emailVerificationCode).mockResolvedValue(true as never);
  });

  it('rejects incomplete registration data before querying users', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await registrationController.userRegister(
      { body: { email: registrationBody.email } } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    expect(usersService.getAllUsers).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'email',
      users: [[{ _id: 'email-match' }]],
      companies: [],
      message: 'Email already exists'
    },
    {
      name: 'username',
      users: [[], [{ _id: 'username-match' }]],
      companies: [],
      message: 'Username already exists'
    },
    {
      name: 'account',
      users: [[], []],
      companies: [{ _id: 'account-match' }],
      message: 'Account already exists'
    }
  ])('rejects a duplicate $name', async ({ users, companies, message }) => {
    for (const result of users) {
      vi.mocked(usersService.getAllUsers).mockResolvedValueOnce(result as never);
    }
    vi.mocked(companyService.getAllCompanies).mockResolvedValue(companies as never);
    const response = makeResponse();
    const next = vi.fn();

    await registrationController.userRegister(
      { body: registrationBody } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(response.status).not.toHaveBeenCalled();
  });

  it('returns the established response after sending a registration code', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await registrationController.userRegister(
      { body: registrationBody } as any,
      response,
      next
    );

    expect(registrationService.emailVerificationCode).toHaveBeenCalledWith({
      email: registrationBody.email,
      firstName: registrationBody.firstName
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'Verification email sent successfully'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not report success when email delivery fails', async () => {
    vi.mocked(registrationService.emailVerificationCode).mockResolvedValue(false as never);
    const response = makeResponse();
    const next = vi.fn();

    await registrationController.userRegister(
      { body: registrationBody } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }));
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([
    { body: { email: registrationBody.email }, message: 'Email and OTP are required' },
    {
      body: { email: registrationBody.email, verificationCode: '123' },
      message: 'Invalid OTP (One Time Password)'
    }
  ])('rejects invalid registration OTP input', async ({ body, message }) => {
    const response = makeResponse();
    const next = vi.fn();

    await registrationController.userOTPVerification(
      { body } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message }));
    expect(registrationService.verifyOTPCode).not.toHaveBeenCalled();
  });

  it('requires the registration service to verify the OTP', async () => {
    vi.mocked(registrationService.verifyOTPCode).mockResolvedValue(false as never);
    const response = makeResponse();
    const next = vi.fn();
    const body = { ...registrationBody, verificationCode: '123456' };

    await registrationController.userOTPVerification(
      { body } as any,
      response,
      next
    );

    expect(registrationService.verifyOTPCode).toHaveBeenCalledWith(body);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('preserves the successful OTP response contract', async () => {
    vi.mocked(registrationService.verifyOTPCode).mockResolvedValue({} as never);
    const response = makeResponse();
    const next = vi.fn();
    const body = { ...registrationBody, verificationCode: '123456' };

    await registrationController.userOTPVerification(
      { body } as any,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith({
      status: true,
      message: 'OTP code verified successfully'
    });
    expect(next).not.toHaveBeenCalled();
  });
});
