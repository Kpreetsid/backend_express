import mongoose from 'mongoose';
import { UserModel } from './user.model';

const EquipmentSchema = new mongoose.Schema({
    equipmentName: { type: { type: String, required: true } },
    equipmentType: { type: String },
    equipmentId: { type: String },
    equipmentOrient: { type: String },
    powUnit: { type: String },
    descr: { type: String },
    location_id: mongoose.Schema.Types.ObjectId,
    userList: [UserModel]
}, { _id: false });

const MotorSchema = new mongoose.Schema({
    title: { type: String },
    motor: { type: String },
    motorType: { type: String },
    lineFreq: { type: String },
    mounting: { type: String },
    minRotation: { type: Number },
    maxRotation: { type: Number },
    rotationUnit: { type: String },
    powerRating: { type: Number }
}, { _id: false });

const FlexibleSchema = new mongoose.Schema({
    title: { type: String },
    element: { type: Number }
}, { _id: false });

const BeltPulleySchema = new mongoose.Schema({
    title: { type: String },
    minInputRotation: { type: Number },
    maxInputRotation: { type: String },
    minOutputRotation: { type: Number },
    maxOutputRotation: { type: Number },
    drivingPulleyDia: { type: Number },
    drivenPulleyDia: { type: Number },
    beltLength: { type: String },
    outputRPM: { type: String },
    noOfGroove: { type: Number }
}, { _id: false });

const GearboxSchema = new mongoose.Schema({
    title: { type: String },
    bearingType: { type: String },
    mounting: { type: String },
    minInputRotation: { type: Number },
    maxInputRotation: { type: Number },
    minOutputRotation: { type: Number },
    maxOutputRotation: { type: Number },
    noStage: { type: String },
    stage_1st_driving_teeth: { type: Number },
    stage_1st_driven_teeth: { type: Number },
    stage_2nd_driving_teeth: { type: Number },
    stage_2nd_driven_teeth: { type: Number },
    stage_3rd_driving_teeth: { type: Number },
    stage_3rd_driven_teeth: { type: Number },
    stage_4th_driving_teeth: { type: Number },
    stage_4th_driven_teeth: { type: Number }
}, { _id: false });

const FansBlowersSchema = new mongoose.Schema({
    title: { type: String },
    brandMake: { type: String },
    brandId: { type: String },
    bearingType: { type: String },
    mounting: { type: String },
    type: { type: String },
    bladeCount: { type: Number },
    minRotation: { type: Number },
    maxRotation: { type: Number },
    specificFreq: [String]
}, { _id: false });

const PumpSchema = new mongoose.Schema({
    title: { type: String },
    brand: { type: String },
    model: { type: String },
    casing: { type: String },
    impellerType: { type: String },
    impellerBladeCount: { type: Number },
    minRotation: { type: Number },
    maxRotation: { type: Number },
    specificFreq: [String]
}, { _id: false });

const CompressorSchema = new mongoose.Schema({
    title: { type: String },
    type: { type: String },
    brandModal: { type: String },
    pinionGearTeethCount: { type: Number },
    timingGearTeethCount: { type: Number },
    powerRating: { type: Number },
    minRotation: { type: Number },
    maxRotation: { type: String },
    specificFreq: [String]
}, { _id: false });

const EquipmentSetSchema = new mongoose.Schema({
    Equipment: {
        label: { type: String },
        value: [EquipmentSchema]
    },
    Motor: {
        label: { type: String },
        value: [MotorSchema]
    },
    Flexible: {
        label: { type: String },
        value: [FlexibleSchema]
    },
    Rigid: {
        label: { type: String },
        value: [mongoose.Schema.Types.Mixed]
    },
    Belt_Pulley: [{
        label: { type: String },
        value: [BeltPulleySchema]
    }],
    Gearbox: [{
        label: { type: String },
        value: [GearboxSchema]
    }],
    Fans_Blowers: {
        label: { type: String },
        value: [FansBlowersSchema]
    },
    Pumps: {
        label: { type: String },
        value: [PumpSchema]
    },
    Compressor: {
        label: { type: String },
        value: [CompressorSchema]
    },
    visible: {
        type: Boolean,
        default: true
    }
}, {
    collection: 'equipment_set',
    timestamps: true,
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform(doc: any, ret: any) {
            ret.id = ret._id;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform(doc: any, ret: any) {
            ret.id = ret._id;
            return ret;
        }
    }
});

export const EquipmentSetModel = mongoose.model('Schema_EquipmentSet', EquipmentSetSchema);
