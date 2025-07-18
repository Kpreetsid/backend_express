import { Schema } from "mongoose";

export interface ISubCategory {
  id: string;
  name: string;
  isSelected: boolean;
}

export interface ICategory {
  id: string;
  categoryName: string;
  subCategory: ISubCategory[];
}

const subCategorySchema = new Schema<ISubCategory>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  isSelected: { type: Boolean, required: true }
});

const FeaturesSchema = new Schema<ICategory>({
  id: { type: String, required: true },
  categoryName: { type: String, required: true },
  subCategory: { type: [subCategorySchema], required: true }
});

export default FeaturesSchema;