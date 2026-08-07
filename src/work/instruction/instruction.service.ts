import { WorkInstructions } from '../../models/workInstructions.model';

class InstructionsService {
  private sanitizeBody(body: any): Record<string, unknown> {
    const source = body || {};
    return {
      title: source.title,
      tag: source.tag,
      description: source.description,
      WI_steps: source.WI_steps,
      ...(source.assetId ? { assetId: source.assetId } : {}),
      ...(source.locationId ? { locationId: source.locationId } : {})
    };
  }

  async getInstructions (match: any): Promise<any> {
    return await WorkInstructions.find(match).sort({ _id: -1 });
  };
  
  async createInstructions (body: any, account_id: any, user_id: any): Promise<any> {
    const newInstruction = new WorkInstructions({
      ...this.sanitizeBody(body),
      account_id,
      createdBy: user_id
    });
    return await newInstruction.save();
  }

  async updateInstructions (id: string, body: any, account_id: any, user_id: any): Promise<any> {
    return await WorkInstructions.findOneAndUpdate(
      { _id: id, account_id, visible: true },
      { ...this.sanitizeBody(body), updatedBy: user_id },
      { returnDocument: 'after' }
    );
  }

  async deleteInstructionsById (id: string, account_id: any, user_id: any): Promise<any> {
    return await WorkInstructions.findOneAndUpdate(
      { _id: id, account_id, visible: true },
      { updatedBy: user_id, visible: false },
      { returnDocument: 'after' }
    );
  }
}

export const instructionService = new InstructionsService();
