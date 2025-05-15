import mongoose, { Document, Schema } from "mongoose";

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
    account_id: mongoose.Types.ObjectId;
    locationId: mongoose.Types.ObjectId;
    categoryId: mongoose.Types.ObjectId;
    description: string;
}

const SOPComponentSchema = new Schema<SOPComponent>({
    type: String,
    label: String,
    key: String,
    size: String,
    block: Boolean,
    action: String,
    disableOnInvalid: Boolean,
    theme: String,
    id: String,
    input: Boolean,
    placeholder: String,
    prefix: String,
    customClass: String,
    suffix: String,
    multiple: Boolean,
    defaultValue: Schema.Types.Mixed,
    protected: Boolean,
    unique: Boolean,
    persistent: Boolean,
    hidden: Boolean,
    clearOnHide: Boolean,
    refreshOn: String,
    redrawOn: String,
    tableView: Boolean,
    modalEdit: Boolean,
    dataGridLabel: Boolean,
    labelPosition: String,
    description: String,
    errorLabel: String,
    tooltip: String,
    hideLabel: Boolean,
    tabindex: String,
    disabled: Boolean,
    autofocus: Boolean,
    dbIndex: Boolean,
    customDefaultValue: String,
    calculateValue: String,
    calculateServer: Boolean,
    widget: {
        type: { type: String }
    },
    attributes: { type: Schema.Types.Mixed, default: {} },
    validateOn: String,
    validate: {
        required: Boolean,
        custom: String,
        customPrivate: Boolean,
        strictDateValidation: Boolean,
        multiple: Boolean,
        unique: Boolean
    },
    conditional: {
        show: { type: Schema.Types.Mixed, default: null },
        when: { type: Schema.Types.Mixed, default: null },
        eq: String
    },
    overlay: {
        style: String,
        left: String,
        top: String,
        width: String,
        height: String
    },
    allowCalculateOverride: Boolean,
    encrypted: Boolean,
    showCharCount: Boolean,
    showWordCount: Boolean,
    properties: { type: Schema.Types.Mixed, default: {} },
    allowMultipleMasks: Boolean,
    addons: { type: [String], default: [] },
    leftIcon: String,
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
        locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
        description: { type: String }
    },
    {
        collection: "sops", 
        timestamps: true,
        versionKey: false
    }
);

export const SopsMasterModel = mongoose.model<ISopsMaster>("SopsMaster", SopsMasterSchema);