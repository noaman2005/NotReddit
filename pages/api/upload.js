import multiparty from 'multiparty';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import mime from 'mime-types';

const bucketName = 'noa-ecommerce';

// Create S3 client once
const s3Client = new S3Client({
    region: 'eu-north-1',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
});

export default async function handle(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Validate environment variables
        const requiredEnvVars = ['S3_ACCESS_KEY', 'S3_SECRET_KEY'];
        const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
        if (missingEnvVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        }

        // Parse form data
        const form = new multiparty.Form();
        const { fields, files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve({ fields, files });
            });
        });

        if (!files || !files.file || files.file.length === 0) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const links = [];
        for (const file of files.file) {
            // Validate file
            if (!file.path || !fs.existsSync(file.path)) {
                console.error('Invalid file path:', file);
                continue;
            }

            try {
                const ext = file.originalFilename.split('.').pop();
                const newFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
                
                // Read file content
                const fileContent = fs.readFileSync(file.path);
                
                // Upload to S3
                await s3Client.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: newFilename,
                    Body: fileContent,
                    ACL: 'public-read',
                    ContentType: mime.lookup(file.path) || 'application/octet-stream',
                }));

                // Generate public URL with correct S3 URL format
                const link = `https://${bucketName}.s3.eu-north-1.amazonaws.com/${newFilename}`;
                links.push(link);

                // Clean up temporary file
                fs.unlinkSync(file.path);
            } catch (error) {
                console.error('Error processing file:', file.originalFilename, error);
                throw error;
            }
        }

        if (links.length === 0) {
            return res.status(400).json({ error: 'No files were successfully uploaded' });
        }

        return res.json({ links });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Error uploading file',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

export const config = {
    api: {
        bodyParser: false,
        sizeLimit: '8mb',
    },
};
