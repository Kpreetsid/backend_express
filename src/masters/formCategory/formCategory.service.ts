import { CategoryModel, ICategory } from "../../models/formCategory.model";
import { IUser } from "../../models/user.model";

class FormCategoryService {

  async getFormCategories(match: any): Promise<ICategory[]> {
    return CategoryModel.find(match).sort({ _id: -1 });
  }

  async getCategoryById(id: any, account_id: any): Promise<ICategory | null> {
    return CategoryModel.findOne({ _id: id, account_id, visible: true });
  }

  async categoryExists(account_id: any, name: string, excludeId?: string) {
    const filter: any = { account_id, name, visible: true };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return CategoryModel.findOne(filter);
  }

  async createFormCategory(body: any, user: IUser) {
    const newCategory = new CategoryModel({
      account_id: user.account_id,
      name: body.name,
      description: body.description || "",
      createdBy: user._id
    });
    return newCategory.save();
  }

  async updateById(id: string, body: any, user: IUser) {
    return CategoryModel.findOneAndUpdate(
      { _id: id, account_id: user.account_id, visible: true },
      { name: body.name, description: body.description, updatedBy: user._id },
      { returnDocument: 'after' }
    );
  }

  async removeById(id: string, account_id: any, user_id: any) {
    return CategoryModel.findOneAndUpdate(
      { _id: id, account_id, visible: true },
      { visible: false, updatedBy: user_id },
      { returnDocument: 'after' }
    );
  }
}

export const formCategoryService = new FormCategoryService();
