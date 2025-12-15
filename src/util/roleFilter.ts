import { IUser } from "../models/user.model";

interface RoleFilterOptions<T> {
  user: IUser;
  baseFilter?: any;
  accountField?: string;   // field name that stores account_id
  createdByField?: string; // optional -> for user-level ownership
}

export const applyRoleFilter = <T>({ user, baseFilter = {}, accountField = "account_id", createdByField = "createdBy" }: RoleFilterOptions<T>): any => {
  let finalFilter: any = { ...baseFilter };
  debugger 

  switch (user.user_role) {
    case "super_admin":
    case "super_employee":
    case "super_user":
      finalFilter = {...baseFilter};
      break;

    case "admin":
      // Admin can access all records from same account
      finalFilter[accountField] = user.account_id;
      finalFilter['visible'] = true;
      break;

    case "manager":
    case "employee":
    case "customer":
      // Manager/Employee → account + visibility
      finalFilter[accountField] = user.account_id;
      finalFilter["visible"] = true;
      break;

    case "user":
      // Normal user → only own records
      finalFilter[accountField] = user.account_id;
      finalFilter[createdByField] = user._id;
      break;

    default:
      throw new Error("Unknown role — cannot apply role filter.");
  }

  return finalFilter;
};
