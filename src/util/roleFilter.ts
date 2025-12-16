import { IUser } from "../models/user.model";

interface RoleFilterOptions<T> {
  user: IUser;
  baseFilter?: any;
  accountField?: string;
  createdByField?: string;
}

export const applyRoleFilter = <T>({ user, baseFilter = {}, accountField = "account_id", createdByField = "createdBy" }: RoleFilterOptions<T>): any => {
  let finalFilter: any = { ...baseFilter };

  switch (user.user_role) {
    case "super_admin":
    case "super_employee":
    case "super_user":
      finalFilter = {...baseFilter};
      break;

    case "admin":
      finalFilter[accountField] = user.account_id;
      finalFilter['visible'] = true;
      break;

    case "manager":
    case "employee":
    case "customer":
      finalFilter[accountField] = user.account_id;
      finalFilter["visible"] = true;
      break;

    case "user":
      finalFilter[accountField] = user.account_id;
      finalFilter[createdByField] = user._id;
      finalFilter["visible"] = true;
      break;

    default:
      throw new Error("Unknown role — cannot apply role filter.");
  }

  return finalFilter;
};
