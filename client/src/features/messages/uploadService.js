import api from "../../services/api";

const uploadService = {
  uploadFile: async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (event) => {
        if (!event.total || !onProgress) return;

        const progress = Math.round(
          (event.loaded / event.total) * 100
        );

        onProgress(progress);
      },
    });

    return response.data.file;
  },
};

export default uploadService;
