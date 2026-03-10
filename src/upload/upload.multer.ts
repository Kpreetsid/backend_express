import fs from "fs";
import path from "path";

class UploadFilesService {
  getFormattedDate(): string {
    const date = new Date();
    const istDate = date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return istDate.replace(/,/g, "").replace(/\//g, "").replace(/:/g, "").replace(/\s/g, "");
  }

  generateFileName(extension: string, folderName?: string, accountId?: string): string {
    const timestamp = this.getFormattedDate();
    let nameParts = [timestamp];
    if (accountId) nameParts.push(accountId);
    if (folderName) nameParts.push(folderName);
    return `${nameParts.join('-')}${extension.startsWith('.') ? extension : `.${extension}`}`;
  }

  getDestinationPath(folderName?: string): string {
    const uploadRoot = path.join(__dirname, '../../uploadFiles');
    const destination = folderName ? path.join(uploadRoot, folderName) : uploadRoot;
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    return destination;
  }

  async uploadBase64Image(base64Image: string, folderName?: string, accountId?: string) {
    try {
      if (!base64Image || typeof base64Image !== "string") {
        throw Object.assign(new Error('Base64 image data is required'), { status: 400 });
      }

      let mimeType = "image/png";
      let base64Data: string;
      const matches = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      } else {
        base64Data = base64Image;
      }

      const imageBuffer = Buffer.from(base64Data, "base64");
      const extension = mimeType.split("/")[1]; // png, jpg, etc.

      const fileName = this.generateFileName(extension, folderName, accountId);
      const destination = this.getDestinationPath(folderName);
      const filePath = path.join(destination, fileName);

      fs.writeFileSync(filePath, imageBuffer);

      return {
        originalName: fileName,
        type: mimeType,
        destination,
        folderName,
        fileName,
        filePath,
        size: imageBuffer.length
      };
    } catch (error) {
      console.error("Image upload error:", error);
      throw error;
    }
  };

  async deleteBase64Image(fileName: string, folderName?: string) {
    try {
      const destination = this.getDestinationPath(folderName);
      const filePath = path.join(destination, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Image delete error:", error);
      throw error;
    }
  };
}

export const uploadFilesService = new UploadFilesService();