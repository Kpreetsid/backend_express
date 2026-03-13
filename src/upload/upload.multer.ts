import fs from "fs";
import path from "path";
import crypto from "crypto";

class UploadFilesService {
  private getFormattedDate(): string {
    const iso = new Date().toISOString();
    const [datePart, timePart] = iso.split("T");
    const date = datePart.replace(/-/g, "");
    const time = timePart.replace(/[:.Z]/g, "");
    return `${date}-${time}`;
  }

  generateFileName(extension: any, folderName?: string, companyId?: string): string {
    const timestamp = this.getFormattedDate();
    const randomId = crypto.randomBytes(4).toString("hex");
    const parts: string[] = [timestamp];
    if (folderName) {
      parts.push(folderName.trim().replace(/\s+/g, "-").toLowerCase());
    }
    if (companyId) {
      parts.push(String(companyId));
    }
    parts.push(randomId);
    return `${parts.join("-")}${extension.startsWith('.') ? extension : `.${extension}`}`;
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