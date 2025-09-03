import { CommentsModel } from "../../models/comment.model";

export const getAllComments = async (match: any) => {
  match.visible = true;
  match.parentCommentId = null;
  const comments = await CommentsModel.find(match).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName' }]).lean();
  if (!comments || comments.length === 0) {
    throw Object.assign(new Error('No data found'), { status: 404 });
  }
  const replies = await Promise.all(comments.map(comment => getNestedComments(comment._id)));
  return comments.map((comment: any, index) => ({ ...comment, id: comment._id, replies: replies[index] }));
};

const getNestedComments = async (parentId: any) => {
  const childComments = await CommentsModel.find({ parentCommentId: parentId, visible: true }).populate([{ path: 'createdBy', model: "Schema_User", select: 'id firstName lastName' }]).lean();
    return await Promise.all(
      childComments.map(async (comment: any) => ({
        ...comment,
        id: comment._id,
        replies: await getNestedComments(comment._id),
      })
    )
  );
};

export const createComment = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const newComment = new CommentsModel({
    account_id: account_id,
    work_order_id: body.work_order_id,
    comments: body.comments,
    parentCommentId: body.parentCommentId || null,
    createdBy: user_id
   });
  return await newComment.save();
};

export const updateComment = async (commentId: any, message: any, user_id: any): Promise<any> => {
  return await CommentsModel.findByIdAndUpdate(commentId, { comments: message, updatedBy: user_id }, { new: true });
};

export const removeComment = async (commentId: any, user_id: any): Promise<any> => {
  return await CommentsModel.findByIdAndUpdate(commentId, { visible: false, updatedBy: user_id }, { new: true });
};