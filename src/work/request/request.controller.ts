import { Request, Response, NextFunction } from 'express';
import { requestService } from './request.service';
import { get } from 'lodash';
import { IUser } from '../../models/user.model';
import { WORK_REQUEST_PRIORITIES, WORK_REQUEST_STATUSES } from '../../models/workRequest.model';
import mongoose from "mongoose";

class RequestController {
  async getAll (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { query: { priority, location, status, assignedTo, assignedBy, approvedBy, rejectedBy }} = req;
      let match: any = { account_id: account_id };
      if(priority) {
        match.priority = priority.toString().split(",").map((p) => p.trim()).filter((p) => p !== "");
      }
      if(location) {
        match.location_id = location.toString().split(",").map((l) => l.trim()).filter((l) => l !== "");
      }
      if(status) {
        match.status = status.toString().split(",").map((s) => s.trim()).filter((s) => s !== "");
      }
      if(assignedTo) {
        match.assigned_to = assignedTo.toString().split(",").map((a) => a.trim()).filter((a) => a !== "");
      }
      if(assignedBy) {
        match.createdBy = assignedBy.toString().split(",").map((a) => a.trim()).filter((a) => a !== "");
      }
      if(approvedBy) {
        match.updatedBy = approvedBy.toString().split(",").map((a) => a.trim()).filter((a) => a !== "");
      }
      if(rejectedBy) {
        match.updatedBy = rejectedBy.toString().split(",").map((a) => a.trim()).filter((a) => a !== "");
      }
      const data = await requestService.getAllRequests(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async getById (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const { params: { id }, query } = req;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 400 });
      }
      let match: any = { _id: new mongoose.Types.ObjectId(String(id)), account_id: account_id };
      if(query) {
        match = { ...match, ...query };
      }
      const data = await requestService.getAllRequests(match);
      if (!data || data.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data fetched successfully", data: data[0] });
    } catch (error) {
      next(error);
    }
  }
  
  async create (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const user = get(req, "user", {}) as IUser;
      const body = req.body;
      const data = await requestService.createRequest(body, user);
      if (!data) {
        throw Object.assign(new Error('No data created'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  }
  
  async update (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, firstName, lastName } = get(req, "user", {}) as IUser;
      const { params: { id, status }, body } = req;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 404 });
      }
      if(status) {
        if(!WORK_REQUEST_STATUSES.includes(String(status))) {
          throw Object.assign(new Error('Status is not editable'), { status: 400 });
        }
        body.status = status;
        if(status === 'Approved' || status === 'Rejected') {
          throw Object.assign(new Error('Create a valid request'), { status: 400 });
        }
      }
      if(body.priority) {
        if(!WORK_REQUEST_PRIORITIES.includes(body.priority)) {
          throw Object.assign(new Error('Invalid priority value'), { status: 400 });
        }
      }
      const existingRequest = await requestService.getAllRequests({ _id: new mongoose.Types.ObjectId(String(id)), account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if(body.remarks !== existingRequest[0].remarks) {
        const dateTime = `${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0]}`;
        body.remarks = existingRequest[0].remarks ? `${existingRequest[0].remarks} ${body.remarks} by ${firstName} ${lastName} on ${dateTime}` : `${body.remarks} by ${firstName} ${lastName} on ${dateTime}`;
      }
      if(status === existingRequest[0].status) {
        throw Object.assign(new Error('No changes detected'), { status: 400 });
      }
      if(status === 'Approved') {
        body.approvedBy = user_id;
      }
      const data = await requestService.updateRequest(String(id), body, user_id);
      if (!data || data.modifiedCount === 0) {
        throw Object.assign(new Error('No data updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }
  
  async approve (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 400 });
      }
      const existingRequest = await requestService.getAllRequests({ _id: new mongoose.Types.ObjectId(String(id)), account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if(existingRequest[0].status === 'Approved') {
        throw Object.assign(new Error('Request is already approved'), { status: 400 });
      }
      const data = await requestService.updateRequest(String(id), { status: 'Approved', updatedBy: user_id }, user_id);
      if (!data || data.modifiedCount === 0) {
        throw Object.assign(new Error('No data updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }
  
  async reject (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id, firstName, lastName } = get(req, "user", {}) as IUser;
      const { params: { id }, body: { remarks } } = req;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('ID is required'), { status: 400 });
      }
      if(!remarks) {
        throw Object.assign(new Error('Remarks is required'), { status: 400 });
      }
      const existingRequest = await requestService.getAllRequests({ _id: new mongoose.Types.ObjectId(String(id)), account_id });
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      if(existingRequest[0].status === 'Rejected') {
        throw Object.assign(new Error('Request is already rejected'), { status: 400 });
      }
      const dateTime = `${new Date().toISOString().split('T')[0]} ${new Date().toISOString().split('T')[1].split('.')[0]}`;
      const updatedRemarks = existingRequest[0].remarks ? `${existingRequest[0].remarks} ${remarks} by ${firstName} ${lastName} on ${dateTime}` : `${remarks} by ${firstName} ${lastName} on ${dateTime}`;
      const data = await requestService.updateRequest(String(id), { status: 'Rejected', remarks: updatedRemarks }, user_id);
      if (!data || data.modifiedCount === 0) {
        throw Object.assign(new Error('No data updated'), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Data updated successfully" });
    } catch (error) {
      next(error);
    }
  }
  
  async remove (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
      const { params: { id } } = req;
      if(!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      const match: any = { _id: new mongoose.Types.ObjectId(String(id)), account_id: account_id };
      const existingRequest = await requestService.getAllRequests(match);
      if (!existingRequest || existingRequest.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      await requestService.deleteRequestById(id, user_id);
      res.status(200).json({ status: true, message: "Data deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export const requestController = new RequestController();