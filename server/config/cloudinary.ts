import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary if environment variables exist
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('Cloudinary initialized with Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
} else if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
  console.log('Cloudinary initialized via CLOUDINARY_URL');
}

export async function uploadToCloudinary(filePath: string, folder = 'vdo_bogura'): Promise<string> {
  try {
    const isCloudinaryConfigured = Boolean(
      process.env.CLOUDINARY_URL ||
        (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    );

    if (isCloudinaryConfigured) {
      const result = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: 'auto',
      });
      // Optionally clean up local temp file after uploading to Cloudinary
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
      return result.secure_url;
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error);
  }

  // Fallback to local upload path if Cloudinary is not configured or fails
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
  return `/uploads/images/${fileName}`;
}
