import { WorkInstructions } from '../../models/workInstructions.model';

export const getInstructions = async (match: any): Promise<any> => {
  return await WorkInstructions.find(match).sort({ _id: -1 });
};

export const createInstructions = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const newInstruction = new WorkInstructions({ ...body, account_id, createdBy: user_id });
  return await newInstruction.save();
}

export const updateInstructions = async (id: string, body: any, user_id: any): Promise<any> => {
  body.updatedBy = user_id;
  return await WorkInstructions.findByIdAndUpdate(id, body, { new: true });
}

export const deleteInstructionsById = async (id: string, user_id: any): Promise<any> => {
  return await WorkInstructions.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
}