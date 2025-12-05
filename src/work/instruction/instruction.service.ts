import { WorkInstructions } from '../../models/workInstructions.model';

class InstructionsService {
  async getInstructions (match: any): Promise<any> {
    return await WorkInstructions.find(match).sort({ _id: -1 });
  };
  
  async createInstructions (body: any, account_id: any, user_id: any): Promise<any> {
    const newInstruction = new WorkInstructions({ ...body, account_id, createdBy: user_id });
    return await newInstruction.save();
  }
  
  async updateInstructions (id: string, body: any, user_id: any): Promise<any> {
    body.updatedBy = user_id;
    return await WorkInstructions.findByIdAndUpdate(id, body, { new: true });
  }
  
  async deleteInstructionsById (id: string, user_id: any): Promise<any> {
    return await WorkInstructions.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
  }  
}

export const instructionService = new InstructionsService();