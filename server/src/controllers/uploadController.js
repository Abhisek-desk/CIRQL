import cloudinary from "../config/cloudinary.js";
import { validateFileSignature } from "../utils/fileValidation.js";

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file",
      });
    }

    if (!validateFileSignature(req.file)) {
      return res.status(400).json({
        success: false,
        message: "File content does not match a supported file type",
      });
    }

    const originalName = req.file.originalname
      .replace(/[\/\\]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 255);

    const isImage = req.file.mimetype.startsWith("image/");

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "cirql/attachments",
          resource_type: isImage ? "image" : "raw",
          use_filename: true,
          unique_filename: true,
          filename_override: originalName,
        },
        (error, uploadedFile) => {
          if (error) {
            reject(error);
          } else {
            resolve(uploadedFile);
          }
        }
      );

      stream.end(req.file.buffer);
    });

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      file: {
        url: result.secure_url,
        publicId: result.public_id,
        name: originalName,
        format: result.format || "",
        size: result.bytes,
        resourceType: result.resource_type,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    // Avoid logging provider response bodies or sensitive configuration.
    console.error("[CLOUDINARY UPLOAD ERROR]", {
      name: error.name,
      code: error.http_code || "UPLOAD_FAILED",
    });

    next(error);
  }
};