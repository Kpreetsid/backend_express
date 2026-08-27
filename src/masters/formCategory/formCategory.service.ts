import { CategoryModel, ICategory } from "../../models/formCategory.model";
import { IUser } from "../../models/user.model";
import { SOPsModel } from '../../models/sops.model';

class FormCategoryService {

  async getFormCategories(match: any): Promise<ICategory[]> {
    return CategoryModel.find(match).sort({ _id: -1 });
  }

  async getCategoryById(id: any, account_id: any): Promise<ICategory | null> {
    return CategoryModel.findOne({ _id: id, account_id, visible: true });
  }

  async categoryExists(account_id: any, name: string, excludeId?: string) {
    const filter: any = {
      account_id,
      name: { $regex: `^${escapeRegExp(String(name || '').trim())}$`, $options: 'i' },
      visible: true
    };
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
      { $set: { name: String(body.name || '').trim(), description: String(body.description || '').trim(), updatedBy: user._id } },
      { returnDocument: 'after', runValidators: true }
    );
  }

  async removeById(id: string, user: IUser) {
    if (await SOPsModel.exists({ account_id: user.account_id, categoryId: id, visible: true })) {
      throw Object.assign(new Error('Category is assigned to an active form and cannot be deleted'), { status: 409 });
    }
    return CategoryModel.findOneAndUpdate(
      { _id: id, account_id: user.account_id, visible: true },
      { $set: { visible: false, updatedBy: user._id } },
      { returnDocument: 'after' }
    );
  }
}

export const formCategoryService = new FormCategoryService();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
