import { ProcedureModel, IProcedure } from '../../models/procedure.model';
import { helperService } from '../../utils/helper';

class ProcedureService {
  async getAllProcedures(match: any): Promise<IProcedure[]> {
    return await ProcedureModel.find({ ...match, visible: true }).sort({ createdAt: -1 }).lean();
  }

  async getProcedureById(id: string, account_id: any): Promise<IProcedure | null> {
    return await ProcedureModel.findOne({ _id: helperService.validateObjectId(id), account_id, visible: true }).lean();
  }

  async createProcedure(body: any, account_id: any, user_id: any): Promise<IProcedure> {
    const procedure = await ProcedureModel.create({
      account_id,
      name: body.name,
      category: body.category || '',
      tags: Array.isArray(body.tags) ? body.tags : [],
      description: body.description || '',
      steps: Array.isArray(body.steps) ? body.steps : [],
      createdBy: user_id
    });
    return procedure.toObject() as IProcedure;
  }

  async updateProcedure(id: string, body: any, account_id: any, user_id: any): Promise<IProcedure | null> {
    await ProcedureModel.findOneAndUpdate(
      { _id: helperService.validateObjectId(id), account_id, visible: true },
      {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category || '' } : {}),
        ...(body.tags !== undefined ? { tags: Array.isArray(body.tags) ? body.tags : [] } : {}),
        ...(body.description !== undefined ? { description: body.description || '' } : {}),
        ...(body.steps !== undefined ? { steps: Array.isArray(body.steps) ? body.steps : [] } : {}),
        updatedBy: user_id
      },
      { new: true }
    );

    return await this.getProcedureById(id, account_id);
  }

  async removeProcedure(id: string, account_id: any, user_id: any): Promise<any> {
    return await ProcedureModel.findOneAndUpdate(
      { _id: helperService.validateObjectId(id), account_id, visible: true },
      { visible: false, updatedBy: user_id },
      { new: true }
    );
  }
}

export const procedureService = new ProcedureService();
