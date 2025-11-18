import Joi from "joi";

export const createInspectionSchema = Joi.object({
  title: Joi.string().min(2).required(),
  description: Joi.string().allow("", null),
  start_date: Joi.string().required(),
  form_id: Joi.string().required(),
  inspection_report: Joi.object().allow(null),
  location_id: Joi.string().required(),
  formCategory: Joi.string().required(),
  status: Joi.string().required(),
  month: Joi.string().required(),
  createdFrom: Joi.string().required(),
  no_of_actions: Joi.number().min(0).default(0)
});

export const updateInspectionSchema = Joi.object({
  title: Joi.string().min(2),
  description: Joi.string().allow("", null),
  start_date: Joi.string(),
  form_id: Joi.string(),
  inspection_report: Joi.object(),
  location_id: Joi.string(),
  formCategory: Joi.string(),
  status: Joi.string(),
  month: Joi.string(),
  createdFrom: Joi.string(),
  no_of_actions: Joi.number().min(0)
});
