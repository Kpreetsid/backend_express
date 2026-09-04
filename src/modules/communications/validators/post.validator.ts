import { body } from 'express-validator';
import { POST_LIMITS, POST_STATUSES, POST_TOPICS, POST_TYPES, POST_VISIBILITIES } from '../policies/post.policy';

const createPostFields = () => [
  body('title').isString().trim().notEmpty().isLength({ max: POST_LIMITS.title }),
  body('subtitle').optional({ nullable: true }).isString().trim().isLength({ max: POST_LIMITS.subtitle }),
  body('postType').isIn(POST_TYPES),
  body('relatedTo').isIn(POST_TOPICS),
  body('description').isString().trim().notEmpty().isLength({ max: POST_LIMITS.description }),
  body('tags').optional().isArray({ max: POST_LIMITS.tagCount }),
  body('tags.*').optional().isString().trim().notEmpty().isLength({ max: POST_LIMITS.tagLength }),
  body('files').optional().isArray({ max: POST_LIMITS.files }),
  body('publishTo').optional().isArray({ max: POST_LIMITS.publishTo }),
  body('publishTo.*').optional().isMongoId(),
  body('status').optional().isIn(POST_STATUSES),
  body('visibility').optional().isIn(POST_VISIBILITIES),
  body('featured').optional().isBoolean({ strict: true }),
  body('pinned').optional().isBoolean({ strict: true }),
  body('commentsEnabled').optional().isBoolean({ strict: true }),
  body('help').optional().isBoolean({ strict: true }),
  body('slug').optional({ nullable: true }).isString().trim().isLength({ max: POST_LIMITS.slug })
    .matches(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/),
  body('seoTitle').optional({ nullable: true }).isString().trim().isLength({ max: POST_LIMITS.seoTitle }),
  body('seoDescription').optional({ nullable: true }).isString().trim().isLength({ max: POST_LIMITS.seoDescription }),
  body('keywords').optional().isArray({ max: POST_LIMITS.keywordCount }),
  body('keywords.*').optional().isString().trim().notEmpty().isLength({ max: POST_LIMITS.tagLength }),
  body('scheduledAt').optional({ nullable: true }).isISO8601({ strict: true }),
  body('reviewNote').optional({ nullable: true }).isString().trim().isLength({ max: POST_LIMITS.reviewNote })
];

export const postValidator = createPostFields();

export const postPatchValidator = [
  body().custom(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
      throw new Error('At least one post field is required');
    }
    return true;
  }),
  ...createPostFields().map(validation => validation.optional({ nullable: true }))
];
