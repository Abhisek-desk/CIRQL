import cloudinary from "../config/cloudinary.js";

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file",
      });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "cirql",
          resource_type: "auto",
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
        format: result.format,
        size: result.bytes,
        resourceType: result.resource_type,
      },
    });
  } catch (error) {
    next(error);
  }
};