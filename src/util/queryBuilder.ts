import { Document, Model } from "mongoose";

interface QueryOptions {
  filter?: Record<string, any>;
  select?: string | string[];
  populate?: string | { path: string; select?: string }[];
  sort?: string | Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  lean?: boolean;
}

export async function getData<T extends Document>( model: Model<T>, options: QueryOptions = {} ): Promise<any[]> {
  let query: any = model.find(options.filter || {});

  if (options.select) {
    query = query.select(options.select);
  }

  const populate = options.populate;
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(p => query.populate(p));
    } else {
      query.populate(populate);
    }
  }

  if (options.sort) {
    query = query.sort(options.sort);
  }

  if (typeof options.skip === "number") {
    query = query.skip(options.skip);
  }

  if (typeof options.limit === "number") {
    query = query.limit(options.limit);
  }

  if (options.lean) {
    query = query;
  }

  const data = await query.exec();
  return data.map((doc: any) => {
    doc = doc.toObject();
    doc.id = doc._id;
    return doc;
  });
}
