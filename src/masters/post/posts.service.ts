import { PostModel, IPost } from "../../models/post.model";

class PostService {
  async getAllPosts(match: any): Promise<IPost[]> {
    return await PostModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "users", let: { uId: "$createdBy" }, pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
            { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, user_profile_img: 1, username: 1 } }
          ],
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $addFields: { id: "$_id" } },
      { $sort: { _id: -1 } },
      { $project: { "user.password": 0 } }
    ]);
  };

  async insertPost(body: any): Promise<any> {
    const newPost = new PostModel(body);
    return await newPost.save();
  };

  async updatePostById(id: any, body: any, user_id: any): Promise<any> {
    return await PostModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { new: true });
  };

  async removePostById(id: any, user_id: any): Promise<any> {
    return await PostModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
  };

  async likePost(id: any, user_id: any): Promise<any> {
    const post = await PostModel.findById(id);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

    const isLiked = post.likes.includes(user_id.toString());
    const isDisliked = post.dislikes.includes(user_id.toString());

    let updateQuery: any = {};

    if (isLiked) {
      updateQuery = { $pull: { likes: user_id } };
    } else {
      updateQuery = { $addToSet: { likes: user_id } };
      if (isDisliked) {
        updateQuery.$pull = { dislikes: user_id };
      }
    }

    return await PostModel.findByIdAndUpdate(id, updateQuery, { new: true });
  };

  async dislikePost(id: any, user_id: any): Promise<any> {
    const post = await PostModel.findById(id);
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

    const isLiked = post.likes.includes(user_id.toString());
    const isDisliked = post.dislikes.includes(user_id.toString());

    let updateQuery: any = {};

    if (isDisliked) {
      updateQuery = { $pull: { dislikes: user_id } };
    } else {
      updateQuery = { $addToSet: { dislikes: user_id } };
      if (isLiked) {
        updateQuery.$pull = { likes: user_id };
      }
    }

    return await PostModel.findByIdAndUpdate(id, updateQuery, { new: true });
  };
}

export const postService = new PostService();