import { WorkInstructions } from '../models/workInstructions.model';

class InstructionsService {
  async getInstructions(match: Record<string, any>): Promise<any[]> {
    return WorkInstructions.find({ ...match, visible: true })
      .sort({ createdAt: -1, _id: -1 })
      .limit(500)
      .lean();
  }

  async createInstructions(body: Record<string, any>, accountId: any, userId: any): Promise<any> {
    return new WorkInstructions({ ...body, account_id: accountId, createdBy: userId }).save();
  }

  async updateInstructions(match: Record<string, any>, body: Record<string, any>, userId: any): Promise<any> {
    return WorkInstructions.findOneAndUpdate(
      { ...match, visible: true },
      { $set: { ...body, updatedBy: userId } },
      { new: true, runValidators: true }
    ).lean();
  }

  async deleteInstructions(match: Record<string, any>, userId: any): Promise<any> {
    return WorkInstructions.findOneAndUpdate(
      { ...match, visible: true },
      { $set: { updatedBy: userId, visible: false } },
      { new: true }
    ).lean();
  }
}

export const instructionService = new InstructionsService();
