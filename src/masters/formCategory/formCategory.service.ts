import { CategoryModel, ICategory } from "../../models/formCategory.model";
import { IUser } from "../../models/user.model";

export const getFormCategories = async (match: any): Promise<ICategory[]> => {
  match.visible = true;
  return await CategoryModel.find(match);
};

export const createFormCategory = async (body: any, user: IUser): Promise<ICategory | null> => {
  const newCategoryBody = new CategoryModel({
    account_id: user.account_id,
    name: body.name,
    description: body.description,
    createdBy: user._id
  });
  return await newCategoryBody.save();
};

export const updateById = async (id: string, body: any, user: IUser): Promise<ICategory | null> => {
  return await CategoryModel.findByIdAndUpdate(id, { name: body.name, description: body.description, updatedBy: user._id }, { new: true });
};

export const removeById = async (id: string): Promise<ICategory | null> => {
  return await CategoryModel.findByIdAndUpdate(id, { visible: false }, { new: true });
};