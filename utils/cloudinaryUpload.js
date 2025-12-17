import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: 'DATN',    
    api_key: '428442324292352',          
    api_secret: 'ICr7wkrQvNwOccCVmywn7Ii5mp0'     
});

export const uploadToCloudinary = (buffer, userId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'avatars',
                public_id: `avatar-${userId}-${Date.now()}`,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        
        uploadStream.end(buffer);
    });
};

export const deleteFromCloudinary = async (imageUrl) => {
    if (!imageUrl) return;
    
    try {
        const urlParts = imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const publicId = fileName.split('.')[0];
        
        await cloudinary.uploader.destroy(`avatars/${publicId}`);
    } catch (error) {
        console.error('Error deleting old image:', error);
    }
};