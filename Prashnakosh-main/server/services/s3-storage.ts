import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UserRole } from "@shared/schema";

const SIGNED_URL_EXPIRY = 600;

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let s3Client: S3Client | null = null;
let bucketName: string | null = null;

export function initS3(config: S3Config): void {
  s3Client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  bucketName = config.bucket;
}

export function isS3Configured(): boolean {
  return s3Client !== null && bucketName !== null;
}

function getS3Key(tenantId: string, examId: string, filename: string): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${tenantId}/exams/${examId}/${sanitizedFilename}`;
}

interface UploadParams {
  tenantId: string;
  examId: string;
  file: Buffer;
  fileName: string;
  fileType: string;
  uploadedBy: string;
}

interface DownloadParams {
  tenantId: string;
  examId: string;
  fileKey: string;
  expiresIn?: number;
}

interface DeleteParams {
  tenantId: string;
  examId: string;
  fileKey: string;
}

interface ListParams {
  tenantId: string;
  examId: string;
}

const UPLOAD_ROLES: UserRole[] = ["teacher", "hod", "admin", "super_admin"];
const DOWNLOAD_ROLES: UserRole[] = ["exam_committee", "principal", "admin", "super_admin"];

export function canUpload(role: UserRole): boolean {
  return UPLOAD_ROLES.includes(role);
}

export function canDownload(role: UserRole): boolean {
  return DOWNLOAD_ROLES.includes(role);
}

export async function uploadExamFile(
  tenantId: string,
  examId: string,
  filename: string,
  content: Buffer,
  contentType: string,
  uploaderRole: UserRole,
  uploaderTenantId: string | null
): Promise<{ key: string } | { error: string }> {
  if (!s3Client || !bucketName) {
    return { error: "S3 storage not configured" };
  }

  if (!canUpload(uploaderRole)) {
    return { error: "Permission denied: role cannot upload files" };
  }

  if (uploaderRole !== "super_admin" && uploaderTenantId !== tenantId) {
    return { error: "Permission denied: tenant mismatch" };
  }

  const key = getS3Key(tenantId, examId, filename);

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }));

    return { key };
  } catch (err: any) {
    console.error("S3 upload error:", err);
    return { error: "Failed to upload file" };
  }
}

export async function getSignedDownloadUrl(
  tenantId: string,
  examId: string,
  filename: string,
  downloaderRole: UserRole,
  downloaderTenantId: string | null
): Promise<{ url: string; expiresIn: number } | { error: string }> {
  if (!s3Client || !bucketName) {
    return { error: "S3 storage not configured" };
  }

  if (!canDownload(downloaderRole)) {
    return { error: "Permission denied: role cannot download files" };
  }

  if (downloaderRole !== "super_admin" && downloaderTenantId !== tenantId) {
    return { error: "Permission denied: tenant mismatch" };
  }

  const key = getS3Key(tenantId, examId, filename);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRY });

    return { url, expiresIn: SIGNED_URL_EXPIRY };
  } catch (err: any) {
    console.error("S3 signed URL error:", err);
    return { error: "Failed to generate download URL" };
  }
}

export async function deleteExamFile(
  tenantId: string,
  examId: string,
  filename: string,
  deleterRole: UserRole,
  deleterTenantId: string | null
): Promise<{ success: boolean } | { error: string }> {
  if (!s3Client || !bucketName) {
    return { error: "S3 storage not configured" };
  }

  const adminRoles: UserRole[] = ["admin", "super_admin"];
  if (!adminRoles.includes(deleterRole)) {
    return { error: "Permission denied: only admins can delete files" };
  }

  if (deleterRole !== "super_admin" && deleterTenantId !== tenantId) {
    return { error: "Permission denied: tenant mismatch" };
  }

  const key = getS3Key(tenantId, examId, filename);

  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));

    return { success: true };
  } catch (err: any) {
    console.error("S3 delete error:", err);
    return { error: "Failed to delete file" };
  }
}

async function listExamFiles(tenantId: string, examId: string): Promise<{ files: { key: string; size: number; lastModified: Date }[] } | { error: string }> {
  if (!s3Client || !bucketName) {
    return { error: "S3 storage not configured" };
  }

  const prefix = `${tenantId}/exams/${examId}/`;

  try {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    }));

    const files = (response.Contents || []).map(item => ({
      key: item.Key?.replace(prefix, "") || "",
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }));

    return { files };
  } catch (err: any) {
    console.error("S3 list error:", err);
    return { error: "Failed to list files" };
  }
}

const s3StorageService = {
  async uploadFile(params: UploadParams): Promise<{ key: string; location: string }> {
    if (!s3Client || !bucketName) {
      throw new Error("S3 storage not configured");
    }

    const key = getS3Key(params.tenantId, params.examId, params.fileName);

    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: params.file,
      ContentType: params.fileType || "application/octet-stream",
      ServerSideEncryption: "AES256",
      Metadata: {
        uploadedBy: params.uploadedBy,
      },
    }));

    return {
      key: params.fileName,
      location: `s3://${bucketName}/${key}`,
    };
  },

  async getSignedDownloadUrl(params: DownloadParams): Promise<string> {
    if (!s3Client || !bucketName) {
      throw new Error("S3 storage not configured");
    }

    const key = getS3Key(params.tenantId, params.examId, params.fileKey);
    const expiresIn = params.expiresIn || SIGNED_URL_EXPIRY;

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  },

  async deleteFile(params: DeleteParams): Promise<void> {
    if (!s3Client || !bucketName) {
      throw new Error("S3 storage not configured");
    }

    const key = getS3Key(params.tenantId, params.examId, params.fileKey);

    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
  },

  async listFiles(params: ListParams): Promise<{ key: string; size: number; lastModified: Date }[]> {
    const result = await listExamFiles(params.tenantId, params.examId);
    if ("error" in result) {
      throw new Error(result.error);
    }
    return result.files;
  },
};

export default s3StorageService;
