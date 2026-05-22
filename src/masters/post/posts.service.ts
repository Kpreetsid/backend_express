import { PostModel, IPost } from "../../models/post.model";
import { LocationModel } from "../../models/location.model";
import { UserModel } from "../../models/user.model";

class PostService {
  async getAllPosts(match: any): Promise<IPost[]> {
    return await PostModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: UserModel.collection.name, let: { uId: "$createdBy" }, pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$uId"] } } },
            { $project: { _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, user_role: 1, user_profile_img: 1, username: 1, user_status: 1 } }
          ],
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: LocationModel.collection.name,
          let: { publishTo: "$publishTo" },
          pipeline: [
            { $addFields: { strId: { $toString: "$_id" } } },
            { $match: { $expr: { $in: ["$strId", { $ifNull: ["$$publishTo", []] }] }, visible: true } },
            { $project: { _id: 1, id: "$_id", location_name: 1, name: "$location_name", location_type: 1, type: "$location_type", top_level: 1, parent_id: 1, visible: 1 } }
          ],
          as: "locations"
        }
      },
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
    return await PostModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id }, { returnDocument: 'after' });
  };

  async removePostById(id: any, user_id: any): Promise<any> {
    return await PostModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { returnDocument: 'after' });
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

    return await PostModel.findByIdAndUpdate(id, updateQuery, { returnDocument: 'after' });
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

    return await PostModel.findByIdAndUpdate(id, updateQuery, { returnDocument: 'after' });
  };
}

export const postService = new PostService();