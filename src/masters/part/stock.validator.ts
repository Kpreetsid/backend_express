import { body } from "express-validator";

export const stockAdjustmentValidator = [
  body("mode")
    .optional()
    .isIn(["add", "remove", "set", "transfer"])
    .withMessage("Invalid stock adjustment mode"),
  body("quantity")
    .notEmpty()
    .withMessage("Stock quantity is required")
    .custom((value) => {
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error(
          "Stock quantity must be a finite number greater than or equal to zero",
        );
      }
      return true;
    }),
  body("note")
    .notEmpty()
    .withMessage("Reason / note is required for stock adjustments")
    .isString()
    .withMessage("Reason / note must be a string")
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage("Reason / note must be between 3 and 500 characters"),
  body("destination_part_id")
    .if(body("mode").equals("transfer"))
    .notEmpty()
    .withMessage("Destination part ID is required for transfers")
    .isMongoId()
    .withMessage("Invalid destination part ID format"),
];
