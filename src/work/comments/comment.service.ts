import { CommentsModel } from "../../models/comment.model";

class CommentService {
  async getAllComments(match: any) {
    match.parentCommentId = match.parentCommentId || null;
    const comments = await CommentsModel.find(match).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]).lean();
    if (!comments || comments.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    
    // Fetch all descendants for these comments would go here if needed
    
    return comments.map((comment: any) => ({
      ...comment,
      id: comment._id,
      replies: [] 
    }));
  };

  async getComments(match: any) {
    return await CommentsModel.find(match).sort({ _id: -1 });
  };

  async getAllCommentsForWorkOrder(match: any) {
    match.visible = true;
    // Remove parentCommentId: null from match to fetch all comments for the order at once
    const orderMatch = { ...match };
    delete orderMatch.parentCommentId;

    const allComments = await CommentsModel.find(orderMatch)
      .populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }])
      .lean();

    if (!allComments || allComments.length === 0) {
      return [];
    }

    return this.buildCommentTree(allComments);
  };

  async getCommentsByOrderIds(orderIds: any[]): Promise<Map<string, any[]>> {
    const allComments = await CommentsModel.find({
      order_id: { $in: orderIds },
      visible: true
    }).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]).lean();

    const orderCommentMap = new Map<string, any[]>();
    
    // Group all comments by order_id
    for (const c of allComments) {
      const orderId = String(c.order_id);
      if (!orderCommentMap.has(orderId)) orderCommentMap.set(orderId, []);
      orderCommentMap.get(orderId)!.push(c);
    }

    const result = new Map<string, any[]>();
    for (const [orderId, comments] of orderCommentMap) {
      result.set(orderId, this.buildCommentTree(comments));
    }
    
    return result;
  }

  buildCommentTree(comments: any[]): any[] {
    const map = new Map();
    const tree: any[] = [];

    comments.forEach(comment => {
      const c = { ...comment, id: comment._id, replies: [] };
      map.set(String(c._id), c);
    });

    comments.forEach(comment => {
      const c = map.get(String(comment._id));
      if (comment.parentCommentId) {
        const parent = map.get(String(comment.parentCommentId));
        if (parent) {
          parent.replies.push(c);
        } else {
          tree.push(c);
        }
      } else {
        tree.push(c);
      }
    });

    return tree;
  }

  async getNestedComments(parentId: any): Promise<any> {
    // This is still here for backward compatibility but should be avoided
    const childComments = await CommentsModel.find({ parentCommentId: parentId, visible: true }).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]).lean();
    return await Promise.all(
      childComments.map(async (comment: any) => ({
        ...comment,
        id: comment._id,
        replies: await this.getNestedComments(comment._id),
      }))
    );
  };

  async createComment(body: any, account_id: any, user_id: any): Promise<any> {
    const newComment = new CommentsModel({
      account_id: account_id,
      order_id: body.order_id,
      comments: body.comments,
      parentCommentId: body.parentCommentId || null,
      createdBy: user_id
    });
    return await newComment.save();
  };

  async updateComment(commentId: any, message: any, user_id: any): Promise<any> {
    return await CommentsModel.findByIdAndUpdate(commentId, { comments: message, updatedBy: user_id }, { new: true });
  };

  async removeComment(commentId: any, user_id: any): Promise<any> {
    const deletedComment = await CommentsModel.findByIdAndUpdate(commentId, { visible: false, updatedBy: user_id }, { new: true });
    if (!deletedComment) {
      throw Object.assign(new Error('Comment not found'), { status: 404 });
    }
    await this.softDeleteChildComments(commentId, user_id);
    return deletedComment;
  };

  async softDeleteChildComments(parentId: any, user_id: any) {
    const childComments = await CommentsModel.find({ parentCommentId: parentId, visible: true }).lean();
    for (const child of childComments) {
      await CommentsModel.findByIdAndUpdate(child._id, { visible: false, updatedBy: user_id }, { new: true });
      await this.softDeleteChildComments(child._id, user_id);
    }
  };
}

export const commentService = new CommentService();