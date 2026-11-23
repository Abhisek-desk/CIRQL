const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const signatures = {
  "image/jpeg": (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,

  "image/png": (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),

  "image/webp": (buffer) =>
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP",

  "application/pdf": (buffer) =>
    buffer.length >= 5 &&
    buffer.toString("ascii", 0, 5) === "%PDF-",

  "application/msword": (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    ),

  "application/vnd.ms-excel": (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    ),

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    (buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04,

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    (buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04,
};

export const validateFileSignature = (file) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    return false;
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return false;
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return false;
  }

  if (file.mimetype === "text/plain") {
    // Plain text must not contain binary null bytes.
    if (file.buffer.includes(0)) return false;

    try {
      new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
      return true;
    } catch {
      return false;
    }
  }

  return signatures[file.mimetype]?.(file.buffer) === true;
};

export const validateAttachments = (attachments) => {
  if (!Array.isArray(attachments) || attachments.length > 5) {
    throw new Error("A message can contain at most 5 attachments");
  }

  return attachments.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("Invalid attachment data");
    }

    const {
      url,
      publicId,
      name,
      format = "",
      size,
      resourceType = "raw",
      mimeType = "",
    } = file;

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("Invalid attachment data");
    }

    if (
      parsedUrl.protocol !== "https:" ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password ||
      typeof publicId !== "string" ||
      !publicId.trim() ||
      publicId.length > 500 ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 255 ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > MAX_FILE_SIZE ||
      !["image", "raw"].includes(resourceType) ||
      typeof format !== "string" ||
      typeof mimeType !== "string" ||
      (mimeType && !ALLOWED_MIME_TYPES.has(mimeType))
    ) {
      throw new Error("Invalid attachment data");
    }

    return {
      url: parsedUrl.toString(),
      publicId,
      name: name.trim(),
      format,
      size,
      resourceType,
      mimeType,
    };
  });
};