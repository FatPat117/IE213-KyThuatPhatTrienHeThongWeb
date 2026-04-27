/**
 * uploadImage.ts
 * Uploads an image file to Cloudinary using unsigned upload preset.
 * Returns the secure URL of the uploaded image.
 *
 * Required env vars (prefix with NEXT_PUBLIC_ for client-side access):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
 */

export interface UploadImageResult {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
}

export async function uploadImageToCloud(
    file: File,
    onProgress?: (percent: number) => void,
): Promise<UploadImageResult> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        throw new Error(
            'Cloudinary chưa được cấu hình. Vui lòng thêm NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME và NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET vào file .env.',
        );
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'campaign-thumbnails');

    return new Promise<UploadImageResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
            'POST',
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        );

        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round(
                        (event.loaded / event.total) * 100,
                    );
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText) as {
                        secure_url: string;
                        public_id: string;
                        width: number;
                        height: number;
                        format: string;
                    };
                    resolve({
                        url: data.secure_url,
                        publicId: data.public_id,
                        width: data.width,
                        height: data.height,
                        format: data.format,
                    });
                } catch {
                    reject(new Error('Phản hồi từ Cloudinary không hợp lệ.'));
                }
            } else {
                try {
                    const errData = JSON.parse(xhr.responseText) as {
                        error?: { message?: string };
                    };
                    reject(
                        new Error(
                            errData.error?.message ||
                                `Upload thất bại với mã lỗi ${xhr.status}`,
                        ),
                    );
                } catch {
                    reject(
                        new Error(`Upload thất bại với mã lỗi ${xhr.status}`),
                    );
                }
            }
        };

        xhr.onerror = () => {
            reject(new Error('Lỗi mạng khi upload ảnh. Vui lòng thử lại.'));
        };

        xhr.onabort = () => {
            reject(new Error('Upload đã bị huỷ.'));
        };

        xhr.send(formData);
    });
}

/**
 * Validates that a file is an acceptable image for campaign thumbnail.
 */
export function validateImageFile(file: File): string | null {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (!ALLOWED_TYPES.includes(file.type)) {
        return `Định dạng không được hỗ trợ. Chấp nhận: JPEG, PNG, WebP, GIF.`;
    }

    if (file.size > MAX_SIZE_BYTES) {
        return `Ảnh không được vượt quá ${MAX_SIZE_MB}MB.`;
    }

    return null;
}
