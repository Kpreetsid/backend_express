// src/cron/scheduleConverter.ts
import { SchedulerModel, IScheduleMaster } from "../models/scheduleMaster.model";
import { JobModel, IJob } from "../models/Job.model";
import { updateNextRun } from "./jobRunner";
import mongoose from "mongoose";

interface JobConversionResult {
    frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom-cron";
    time?: string;
    customDays?: number[];
    cronExpression?: string;
}

function convertScheduleToJob(schedule: IScheduleMaster): JobConversionResult {
    const mode = schedule.schedule_mode?.toLowerCase();

    switch (mode) {
        case "daily":
            return {
                frequency: "daily",
                time: "09:00"
            };

        case "weekly":
            const weekDays: number[] = [];
            if (schedule.monday) weekDays.push(1);
            if (schedule.tuesday) weekDays.push(2);
            if (schedule.wednesday) weekDays.push(3);
            if (schedule.thursday) weekDays.push(4);
            if (schedule.friday) weekDays.push(5);
            if (schedule.saturday) weekDays.push(6);
            if (schedule.sunday) weekDays.push(0);

            return {
                frequency: "weekly",
                time: "09:00",
                customDays: weekDays.length > 0 ? weekDays : [1]
            };

        case "monthly":
            const monthDay = schedule.dayOfMonth ? parseInt(schedule.dayOfMonth) : 1;
            return {
                frequency: "monthly",
                time: "09:00",
                customDays: [monthDay]
            };

        case "hourly":
            return {
                frequency: "hourly"
            };

        case "custom":
            return {
                frequency: "daily",
                time: "09:00"
            };

        default:
            return {
                frequency: "daily",
                time: "09:00"
            };
    }
}

export async function convertScheduleMasterToJobs(): Promise<void> {
    try {
        console.log("🔄 Converting Schedule Master entries to Jobs...");

        // REMOVED: Don't create duplicate work order schedules
        // This was causing duplicate work order creation

        const schedules = await SchedulerModel.find({
            visible: true,
            rescheduleEnabled: { $ne: true } // Only non-work-order schedules
        });
        console.log(`Found ${schedules.length} schedule master entries`);

        for (const schedule of schedules) {
            const existingJob = await JobModel.findOne({ scheduleMasterId: (schedule._id as any).toString() });

            if (existingJob) {
                console.log(`Job already exists for schedule: ${schedule.title}`);
                continue;
            }

            const conversion = convertScheduleToJob(schedule);

            const jobData: Partial<IJob> = {
                name: `Schedule: ${schedule.title}`,
                type: "schedule_master",
                frequency: conversion.frequency,
                time: conversion.time,
                customDays: conversion.customDays,
                cronExpression: conversion.cronExpression,
                timezone: "Asia/Kolkata",
                startDate: schedule.start_date ? new Date(schedule.start_date) : new Date(),
                isActive: true,
                paused: false,
                maxRetries: 3,
                retryDelayMs: 5000,
                backoffFactor: 2,
                lockTtlMs: 300000,
                scheduleMasterId: (schedule._id as any).toString(),
                scheduleMode: schedule.schedule_mode,
                workOrder: schedule.work_order,
                accountId: schedule.account_id.toString(),
                payload: {
                    scheduleMaster: {
                        id: (schedule._id as any).toString(),
                        title: schedule.title,
                        description: schedule.description,

                        workOrder: schedule.work_order,
                        rescheduleEnabled: schedule.rescheduleEnabled,
                        accountId: schedule.account_id.toString(),
                        prevAssetId: schedule.prev_asset_id?.toString(),
                        prevLocId: schedule.prev_loc_id?.toString()
                    }
                }
            };

            const job = await JobModel.create(jobData);
            await updateNextRun(job);

            console.log(`✅ Created job for schedule: ${schedule.title} (${conversion.frequency})`);
        }

        console.log("✅ Schedule Master conversion completed!");
    } catch (error) {
        console.error("❌ Error converting Schedule Master to Jobs:", error);
        throw error;
    }
}

export async function createSampleJobs(): Promise<void> {
    try {
        console.log("🔄 Creating sample jobs...");

        const sampleJobs = [
            {
                name: "Test Job - Every 30 seconds",
                type: "custom" as const,
                frequency: "custom-cron" as const,
                cronExpression: "*/30 * * * * *",
                timezone: "Asia/Kolkata",
                isActive: true,
                paused: false,
                maxRetries: 3,
                retryDelayMs: 1000,
                backoffFactor: 2,
                lockTtlMs: 30000,
                payload: { message: "30-second test job" }
            },
            {
                name: "Test Job - Every 2 minutes",
                type: "custom" as const,
                frequency: "custom-cron" as const,
                cronExpression: "0 */2 * * * *",
                timezone: "Asia/Kolkata",
                isActive: true,
                paused: false,
                maxRetries: 3,
                retryDelayMs: 2000,
                backoffFactor: 2,
                lockTtlMs: 60000,
                payload: { message: "2-minute test job" }
            },
            {
                name: "Daily Cleanup Job",
                type: "cleanup" as const,
                frequency: "daily" as const,
                time: "10:30",
                timezone: "Asia/Kolkata",
                isActive: true,
                paused: false,
                maxRetries: 5,
                retryDelayMs: 5000,
                backoffFactor: 2,
                lockTtlMs: 300000,
                payload: { cleanupType: "temp_files", retentionDays: 7 }
            }
        ];

        for (const jobData of sampleJobs) {
            const existingJob = await JobModel.findOne({ name: jobData.name });
            if (existingJob) {
                console.log(`Job already exists: ${jobData.name}`);
                continue;
            }

            const job = await JobModel.create(jobData);
            await updateNextRun(job);
            console.log(`✅ Created sample job: ${jobData.name}`);
        }

        console.log("✅ Sample jobs creation completed!");
    } catch (error) {
        console.error("❌ Error creating sample jobs:", error);
        throw error;
    }
}