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
  id: { type: String, trim: true, required: true },
  name: { type: String, trim: true, required: true },
  isSelected: { type: Boolean, required: true }
});

const FeaturesSchema = new Schema<ICategory>({
  id: { type: String, trim: true, required: true },
  categoryName: { type: String, trim: true, required: true },
  subCategory: { type: [subCategorySchema], required: true }
});

export default FeaturesSchema;