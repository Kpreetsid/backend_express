import fs from "fs";
import path from "path";
import { UserModel } from "../models/user.model";

const USER_IMG_DIR = path.join(__dirname, "../../uploadFiles/user_profile_img");

class CleanupUploadFiles {
    async cleanupUserImages () {
      try {
        console.log("User image cleanup cron started...");
        const users = await UserModel.find({}, { user_profile_img: 1 });
        const dbImageNames = users.map(u => u.user_profile_img).filter(Boolean);
        const folderFiles = fs.readdirSync(USER_IMG_DIR);
        const filesToDelete = folderFiles.filter(
          file => !dbImageNames.includes(file)
        );
        for (const file of filesToDelete) {
          const deletePath = path.join(USER_IMG_DIR, file);
          fs.unlinkSync(deletePath);
          console.log("Deleted unused file:", file);
        }
        console.log("Cleanup complete.");
      } catch (err) {
        console.error("Error in cleanup cron:", err);
      }
    };
}

export const cleanupUploadFiles = new CleanupUploadFiles();