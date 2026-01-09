/**
 * Client-side image compression utility using browser-image-compression
 * 
 * Compresses images before uploading to Supabase Storage to reduce file size
 * and improve upload speeds, especially on mobile devices.
 */

import imageCompression from 'browser-image-compression';

// Allowed image types for compression
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Maximum file size before compression (10 MB)
const MAX_FILE_SIZE_MB = 10;

// Compression options
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

/**
 * Validates and compresses an image file
 * 
 * @param file - The image file to compress
 * @returns A Promise that resolves to the compressed File object
 * @throws Error if file type is not supported or file is too large
 */
export async function compressImage(file: File): Promise<File> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Allowed types: JPEG, PNG, WebP`);
  }

  // Validate file size (reject files larger than 8 MB before compression)
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`File is too large (${fileSizeMB.toFixed(2)} MB). Maximum allowed: ${MAX_FILE_SIZE_MB} MB`);
  }

  try {
    // Compress the image
    const compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
    
    // Convert Blob to File to maintain File interface
    const compressedFile = new File([compressedBlob], file.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });

    // Log compression stats for debugging
    const originalSizeMB = file.size / (1024 * 1024);
    const compressedSizeMB = compressedFile.size / (1024 * 1024);
    const compressionRatio = ((1 - compressedSizeMB / originalSizeMB) * 100).toFixed(1);
    
    console.log(
      `Image compressed: ${originalSizeMB.toFixed(2)} MB → ${compressedSizeMB.toFixed(2)} MB (${compressionRatio}% reduction)`
    );

    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error('Failed to compress image. Please try a different image.');
  }
}

/**
 * Check if a file is a compressible image
 * 
 * @param file - The file to check
 * @returns true if the file is a compressible image type
 */
export function isCompressibleImage(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type);
}
