import cloudinary from "../config/cloudinary.js";

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file",
      });
    }

    const originalName = req.file.originalname
      .replace(/[\/\\]/g, "_")
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
    console.error("[CLOUDINARY UPLOAD ERROR]", {
  message: error.message,
  http_code: error.http_code,
  name: error.name,
  cloudinaryMessage:
    error.error?.message ||
    error.response?.data?.error?.message ||
    error.response?.body?.error?.message ||
    null,
  responseBody: error.response?.body || null,
});

    next(error);
  }
};



