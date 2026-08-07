import { CommentsModel } from "../../../models/comment.model";
import { PostModel } from "../../../models/post.model";

class CommentService {
  async getAllComments (match: any) {
    const scopedMatch = {
      ...match,
      visible: true,
      parentCommentId: match.parentCommentId || null
    };
    const comments = await CommentsModel.find(scopedMatch).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]).lean();
    if (!comments || comments.length === 0) {
      throw Object.assign(new Error('No records found'), { status: 404 });
    }
    const replies = await Promise.all(comments.map(comment => this.getNestedComments(
      comment._id,
      scopedMatch.account_id,
      scopedMatch.post_id
    )));
    return comments.map((comment: any, index) => ({ ...comment, id: comment._id, replies: replies[index] }));
  };

  async getComments (match: any) {
    return await CommentsModel.find(match).sort({ _id: -1 });
  };

  async getAllCommentsForPost (match: any) {
    const scopedMatch = { ...match, visible: true, parentCommentId: null };
    const comments = await CommentsModel.find(scopedMatch).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]).lean();
    if (!comments || comments.length === 0) {
      return [];
    }
    const replies = await Promise.all(comments.map(comment => this.getNestedComments(
      comment._id,
      scopedMatch.account_id,
      scopedMatch.post_id
    )));
    return comments.map((comment: any, index) => ({ ...comment, id: comment._id, replies: replies[index] }));
  };

  getNestedComments = async (
    parentId: any,
    account_id: any,
    post_id: any
  ): Promise<any> => {
    const childComments = await CommentsModel.find({
      parentCommentId: parentId,
      account_id,
      post_id,
      visible: true
    }).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName email username user_role user_profile_img user_status' }]).lean();
      return await Promise.all(
        childComments.map(async (comment: any) => ({
          ...comment,
          id: comment._id,
          replies: await this.getNestedComments(comment._id, account_id, post_id),
        })
      )
    );
  };

  async createComment (body: any, account_id: any, user_id: any): Promise<any> {
    const post = await PostModel.exists({
      _id: body.post_id,
      account_id,
      visible: true
    });
    if (!post) {
      throw Object.assign(new Error('Post not found'), { status: 404 });
    }
    if (body.parentCommentId) {
      const parentComment = await CommentsModel.exists({
        _id: body.parentCommentId,
        account_id,
        post_id: body.post_id,
        visible: true
      });
      if (!parentComment) {
        throw Object.assign(new Error('Parent comment not found'), { status: 404 });
      }
    }
    const newComment = new CommentsModel({
      account_id: account_id,
      post_id: body.post_id,
      comments: body.comments,
      parentCommentId: body.parentCommentId || null,
      createdBy: user_id
    });
    return await newComment.save();
  };

  async updateComment (match: any, message: any, user_id: any): Promise<any> {
    return await CommentsModel.findOneAndUpdate(
      { ...match, visible: true },
      { comments: message, updatedBy: user_id },
      { returnDocument: 'after' }
    );
  };

  async removeComment (match: any, user_id: any): Promise<any> {
    const deletedComment = await CommentsModel.findOneAndUpdate(
      { ...match, visible: true },
      { visible: false, updatedBy: user_id },
      { returnDocument: 'after' }
    );
    if (!deletedComment) {
      throw Object.assign(new Error('Comment not found'), { status: 404 });
    }
    await this.softDeleteChildComments(
      deletedComment._id,
      deletedComment.account_id,
      deletedComment.post_id,
      user_id
    );
    return deletedComment;
  };

  async softDeleteChildComments (
    parentId: any,
    account_id: any,
    post_id: any,
    user_id: any
  ) {
    const childComments = await CommentsModel.find({
      parentCommentId: parentId,
      account_id,
      post_id,
      visible: true
    }).lean();
    for (const child of childComments) {
      await CommentsModel.findOneAndUpdate(
        { _id: child._id, account_id, post_id, visible: true },
        { visible: false, updatedBy: user_id },
        { returnDocument: 'after' }
      );
      await this.softDeleteChildComments(child._id, account_id, post_id, user_id);
    }
  };
}

export const commentService = new CommentService();
