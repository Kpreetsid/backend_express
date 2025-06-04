import { Document, Model } from "mongoose";

interface QueryOptions {
  filter?: Record<string, any>;
  select?: string | string[];
  populate?: string | { path: string; select?: string }[];
  sort?: string | Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

export async function getData<T extends Document>(model: Model<T>, options: QueryOptions = {}): Promise<T[]> {
  let query: any = model.find(options.filter || {});

  if (options.select) {
    query = query.select(options.select);
  }

  if (options.populate) {
    query = query.populate(options.populate);
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

  return await query.exec();
}
