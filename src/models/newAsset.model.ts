import mongoose from 'mongoose';
import { UserModel } from './user.model';

const EquipmentSchema = new mongoose.Schema({
    equipmentName: String,
    equipmentType: String,
    equipmentId: String,
    equipmentOrient: String,
    powUnit: String,
    descr: String,
    location_id: mongoose.Schema.Types.ObjectId,
    userList: [UserModel]
}, { _id: false });

const MotorSchema = new mongoose.Schema({
    title: String,
    motor: String,
    motorType: String,
    lineFreq: String,
    mounting: String,
    minRotation: Number,
    maxRotation: Number,
    rotationUnit: String,
    powerRating: Number
}, { _id: false });

const FlexibleSchema = new mongoose.Schema({
    title: String,
    element: Number
}, { _id: false });

const BeltPulleySchema = new mongoose.Schema({
    title: String,
    minInputRotation: Number,
    maxInputRotation: String,
    minOutputRotation: Number,
    maxOutputRotation: Number,
    drivingPulleyDia: Number,
    drivenPulleyDia: Number,
    beltLength: String,
    outputRPM: String,
    noOfGroove: Number
}, { _id: false });

const GearboxSchema = new mongoose.Schema({
    title: String,
    bearingType: String,
    mounting: String,
    minInputRotation: Number,
    maxInputRotation: Number,
    minOutputRotation: Number,
    maxOutputRotation: Number,
    noStage: String,
    stage_1st_driving_teeth: Number,
    stage_1st_driven_teeth: Number,
    stage_2nd_driving_teeth: Number,
    stage_2nd_driven_teeth: Number,
    stage_3rd_driving_teeth: Number,
    stage_3rd_driven_teeth: Number,
    stage_4th_driving_teeth: Number,
    stage_4th_driven_teeth: Number
}, { _id: false });

const FansBlowersSchema = new mongoose.Schema({
    title: String,
    brandMake: String,
    brandId: String,
    bearingType: String,
    mounting: String,
    type: String,
    bladeCount: Number,
    minRotation: Number,
    maxRotation: Number,
    specificFreq: [String]
}, { _id: false });

const PumpSchema = new mongoose.Schema({
    title: String,
    brand: String,
    model: String,
    casing: String,
    impellerType: String,
    impellerBladeCount: Number,
    minRotation: Number,
    maxRotation: Number,
    specificFreq: [String]
}, { _id: false });

const CompressorSchema = new mongoose.Schema({
    title: String,
    type: String,
    brandModal: String,
    pinionGearTeethCount: Number,
    timingGearTeethCount: Number,
    powerRating: Number,
    minRotation: Number,
    maxRotation: String,
    specificFreq: [String]
}, { _id: false });

const EquipmentSetSchema = new mongoose.Schema({
    Equipment: {
        label: String,
        value: [EquipmentSchema]
    },
    Motor: {
        label: String,
        value: [MotorSchema]
    },
    Flexible: {
        label: String,
        value: [FlexibleSchema]
    },
    Rigid: {
        label: String,
        value: [mongoose.Schema.Types.Mixed]
    },
    Belt_Pulley: [{
        label: String,
        value: [BeltPulleySchema]
    }],
    Gearbox: [{
        label: String,
        value: [GearboxSchema]
    }],
    Fans_Blowers: {
        label: String,
        value: [FansBlowersSchema]
    },
    Pumps: {
        label: String,
        value: [PumpSchema]
    },
    Compressor: {
        label: String,
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
      delete ret._id;
      return ret;
    }
  }
});

export const EquipmentSetModel = mongoose.model('Schema_EquipmentSet', EquipmentSetSchema);
