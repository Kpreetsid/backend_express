import mongoose, { Document, ObjectId, Schema } from "mongoose";

interface SOPComponent {
    type: string;
    label: string;
    key: string;
    size: string;
    block: boolean;
    action: string;
    disableOnInvalid: boolean;
    theme: string;
    id: string;
    input: boolean;
    placeholder: string;
    prefix: string;
    customClass: string;
    suffix: string;
    multiple: boolean;
    defaultValue: any;
    protected: boolean;
    unique: boolean;
    persistent: boolean;
    hidden: boolean;
    clearOnHide: boolean;
    refreshOn: string;
    redrawOn: string;
    tableView: boolean;
    modalEdit: boolean;
    dataGridLabel: boolean;
    labelPosition: string;
    description: string;
    errorLabel: string;
    tooltip: string;
    hideLabel: boolean;
    tabindex: string;
    disabled: boolean;
    autofocus: boolean;
    dbIndex: boolean;
    customDefaultValue: string;
    calculateValue: string;
    calculateServer: boolean;
    widget: {
        type: string;
    };
    attributes: Record<string, any>;
    validateOn: string;
    validate: {
        required: boolean;
        custom: string;
        customPrivate: boolean;
        strictDateValidation: boolean;
        multiple: boolean;
        unique: boolean;
    };
    conditional: {
        show: boolean | null;
        when: string | null;
        eq: string;
    };
    overlay: {
        style: string;
        left: string;
        top: string;
        width: string;
        height: string;
    };
    allowCalculateOverride: boolean;
    encrypted: boolean;
    showCharCount: boolean;
    showWordCount: boolean;
    properties: Record<string, any>;
    allowMultipleMasks: boolean;
    addons: any[];
    leftIcon: string;
    rightIcon: string;
}

export interface ISopsMaster extends Document {
    name: string;
    visible: boolean;
    json_temp: {
        components: SOPComponent[];
    };
    account_id: ObjectId;
    locationId: ObjectId;
    categoryId: ObjectId;
    description: string;
}

const SOPComponentSchema = new Schema<SOPComponent>({
    type: { type: String },
    label: { type: String },
    key: { type: String },
    size: { type: String },
    block: { type: Boolean },
    action: { type: String },
    disableOnInvalid: { type: Boolean },
    theme: { type: String },
    id: { type: String },
    input: { type: Boolean },
    placeholder: { type: String },
    prefix: { type: String },
    customClass: { type: String },
    suffix: { type: String },
    multiple: { type: Boolean },
    defaultValue: Schema.Types.Mixed,
    protected: { type: Boolean },
    unique: { type: Boolean },
    persistent: { type: Boolean },
    hidden: { type: Boolean },
    clearOnHide: { type: Boolean },
    refreshOn: { type: String },
    redrawOn: { type: String },
    tableView: { type: Boolean },
    modalEdit: { type: Boolean },
    dataGridLabel: { type: Boolean },
    labelPosition: { type: String },
    description: { type: String },
    errorLabel: { type: String },
    tooltip: { type: String },
    hideLabel: { type: Boolean },
    tabindex: { type: String },
    disabled: { type: Boolean },
    autofocus: { type: Boolean },
    dbIndex: { type: Boolean },
    customDefaultValue: { type: String },
    calculateValue: { type: String },
    calculateServer: { type: Boolean },
    widget: {
        type: { type: String }
    },
    attributes: { type: Schema.Types.Mixed, default: {} },
    validateOn: { type: String },
    validate: {
        required: { type: Boolean },
        custom: { type: String },
        customPrivate: { type: Boolean },
        strictDateValidation: { type: Boolean },
        multiple: { type: Boolean },
        unique: Boolean
    },
    conditional: {
        show: { type: Schema.Types.Mixed },
        when: { type: Schema.Types.Mixed },
        eq: String
    },
    overlay: {
        style: { type: String },
        left: { type: String },
        top: { type: String },
        width: { type: String },
        height: String
    },
    allowCalculateOverride: { type: Boolean },
    encrypted: { type: Boolean },
    showCharCount: { type: Boolean },
    showWordCount: { type: Boolean },
    properties: { type: Schema.Types.Mixed, default: {} },
    allowMultipleMasks: { type: Boolean },
    addons: { type: [String] },
    leftIcon: { type: String },
    rightIcon: String
}, { _id: false });

const SopsMasterSchema = new Schema<ISopsMaster>(
    {
        name: { type: String, required: true },
        visible: { type: Boolean, default: true },
        json_temp: {
            components: [SOPComponentSchema]
        },
        account_id: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
        locationId: { type: Schema.Types.ObjectId, ref: 'LocationMaster', required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        description: { type: String }
    },
    {
        collection: "sops", 
        timestamps: true,
        versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      ret.id = ret._id;
      return ret;
    }
  }
    }
);

export const SopsMasterModel = mongoose.model<ISopsMaster>("SopsMaster", SopsMasterSchema);