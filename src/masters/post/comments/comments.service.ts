import { CommentsModel } from "../../../models/comment.model";

class CommentService {
  async getAllComments (match: any) {
    match.parentCommentId = match.parentCommentId || null;
    const comments = await CommentsModel.find(match).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email user_role user_profile_img user_status' }]).lean();
    if (!comments || comments.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const replies = await Promise.all(comments.map(comment => this.getNestedComments(comment._id)));
    return comments.map((comment: any, index) => ({ ...comment, id: comment._id, replies: replies[index] }));
  };

  async getComments (match: any) {
    return await CommentsModel.find(match).sort({ _id: -1 });
  };

  async getAllCommentsForPost (match: any) {
    match.visible = true;
    match.parentCommentId = null;
    const comments = await CommentsModel.find(match).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email user_role user_profile_img user_status' }]).lean();
    if (!comments || comments.length === 0) {
      return [];
    }
    const replies = await Promise.all(comments.map(comment => this.getNestedComments(comment._id)));
    return comments.map((comment: any, index) => ({ ...comment, id: comment._id, replies: replies[index] }));
  };

  getNestedComments = async (parentId: any): Promise<any> => {
    const childComments = await CommentsModel.find({ parentCommentId: parentId, visible: true }).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email user_role user_profile_img user_status' }]).lean();
      return await Promise.all(
        childComments.map(async (comment: any) => ({
          ...comment,
          id: comment._id,
          replies: await this.getNestedComments(comment._id),
        })
      )
    );
  };

  async createComment (body: any, account_id: any, user_id: any): Promise<any> {
    const newComment = new CommentsModel({
      account_id: account_id,
      post_id: body.post_id,
      comments: body.comments,
      parentCommentId: body.parentCommentId || null,
      createdBy: user_id
    });
    return await newComment.save();
  };

  async updateComment (commentId: any, message: any, user_id: any): Promise<any> {
    return await CommentsModel.findByIdAndUpdate(commentId, { comments: message, updatedBy: user_id }, { new: true });
  };

  async removeComment (commentId: any, user_id: any): Promise<any> {
    const deletedComment = await CommentsModel.findByIdAndUpdate(commentId, { visible: false, updatedBy: user_id }, { new: true });
    if (!deletedComment) {
      throw Object.assign(new Error('Comment not found'), { status: 404 });
    }
    await this.softDeleteChildComments(commentId, user_id);
    return deletedComment;
  };

  async softDeleteChildComments (parentId: any, user_id: any) {
    const childComments = await CommentsModel.find({ parentCommentId: parentId, visible: true }).lean();
    for (const child of childComments) {
      await CommentsModel.findByIdAndUpdate(child._id, { visible: false, updatedBy: user_id }, { new: true });
      await this.softDeleteChildComments(child._id, user_id);
    }
  };
}

export const commentService = new CommentService();