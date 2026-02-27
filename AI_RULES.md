# CMMS-API Project Rules & Guidelines

These are the rules and patterns I must always follow when modifying or creating new code in this project.

## 1. Database Queries & Mongoose Aggregation
- **Soft Deletes**: Almost all collections use soft deletes via a `visible: boolean` flag. Always include `visible: true` in `find()` queries and `$match` aggregation pipeline stages unless explicitly asked to return deleted (inactive) records.
- **ObjectId Validation**: Always validate MongoDB ObjectIds coming from `req.query`, `req.params`, or `req.body` using `helperService.validateObjectId(id)`.
- **Aggregation Lookups (`$lookup`)**: 
  - Ensure local and foreign fields are correctly typed. If mixing ObjectIds and string IDs, use `$expr` and `$toString` or `$toObjectId` appropriately.
  - Always project explicitly within `$lookup` pipeline to avoid pulling heavy/unnecessary data.

## 2. Common Data Projections (Standardization)
When populating or looking up specific models, consistently expose the following specific fields to ensure the front-end receives unified data:

- **Users (`Schema_User`)**: 
  Always include `user_status`, `email`, and `user_role` along with the basics.
  - **$project Example**: `{ _id: 1, id: "$_id", firstName: 1, lastName: 1, email: 1, user_role: 1, user_status: 1, user_profile_img: 1, username: 1 }`
  - **.select() Example**: `'id firstName lastName email user_role user_status user_profile_img username'`
  - * Security Notice: Never expose `password` fields. 

- **Assets/Equipment (`Schema_Asset`)**:
  Always expose `id`, `asset_name`, `asset_type`, and `visible: 1` (or `visible: true` in match conditions).

- **Location (`Schema_Location`)**:
  Always expose `id`, `location_name`, `location_type` and `visible: 1` (or `visible: true` in match conditions).

## 3. Data Deletion
- **Never Hard Delete**: Do not use `.deleteOne()` or `.deleteMany()` for main entities (unless for joining tables like user-asset mappings where it's safe to hard-delete mappings instead of the entities). 
- **Target Pattern**: `findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true })`.

## 4. API Response Structure & Error Handling
- **Success Responses**: Always wrap successful responses uniformly. Example:
  `res.status(200).json({ status: true, message: "Operation successful", data });`
- **Error Handling**: Throw predictable errors including HTTP error codes to trigger the global error handler middleware cleanly. Example:
  `throw Object.assign(new Error("Record not found"), { status: 404 });`

## 5. Security & Context
- Always extract user context via Lodash from `req.user`:
  `const { account_id, _id: user_id, user_role } = get(req, "user", {}) as IUser;`
- Ensure operations append `account_id` and audit properties (`createdBy` or `updatedBy`).

## 6. Type Safety
- Since we use TypeScript, check for compile-time errors. Always verify builds with `npx tsc --noEmit` after changing controllers or services.
