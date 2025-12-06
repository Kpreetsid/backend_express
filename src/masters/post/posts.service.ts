import { PostModel, IPost } from "../../models/post.model";
import { Request, Response, NextFunction } from 'express';

class PostService { 
   async getAllParts (match: any): Promise<IPost[]> {
    match.visible = true;
    return await PostModel.find(match).sort({ _id: -1 });
  };
  
   async insert (req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const newPost = new PostModel(req.body);
      const data = await newPost.save();
      return res.status(201).json({ status: true, message: "Data created successfully", data });
    } catch (error) {
      next(error);
    }
  };
  
   async updateById (id: any, body: any, user_id: any): Promise<any> {
    await PostModel.findByIdAndUpdate(id, body, { new: true });
  };
  
   async removeById (id: any, user_id: any): Promise<any> {
    return await PostModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
  };
}

export const postService = new PostService();