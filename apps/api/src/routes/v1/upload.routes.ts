import { FastifyPluginAsync } from 'fastify';
import { UploadService } from '../../services/upload.service.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../middleware/response.js';

const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const DANGEROUS_EXTENSIONS = new Set([
  'php', 'php3', 'php4', 'php5', 'phtml', 'phar',
  'exe', 'sh', 'bash', 'bat', 'cmd', 'js', 'ts',
  'jsp', 'asp', 'aspx', 'cgi', 'pl', 'py', 'vbs',
  'scr', 'dll', 'com', 'jar', 'war', 'msi', 'bin'
]);

const uploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif'], {
    errorMap: () => ({ message: 'Only image uploads (JPEG, PNG, WebP, GIF) are allowed' }),
  }),
  size: z.number().max(5 * 1024 * 1024, 'File size must be under 5MB').optional(),
});

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.post('/presigned-url', async (request, reply) => {
    try {
      // Only admins and store managers can upload
      if (!request.user || !['SUPER_ADMIN', 'STORE_MANAGER'].includes(request.user.role)) {
        return sendError(reply, 'Forbidden: Insufficient permissions', 403);
      }

      const parsed = uploadSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, parsed.error.errors[0]?.message || 'Invalid upload parameters', 400);
      }

      const rawFileName = parsed.data.fileName;

      // Bug 68: Reject path traversal or null byte injection
      if (rawFileName.includes('\0') || rawFileName.includes('..') || rawFileName.includes('/') || rawFileName.includes('\\')) {
        return sendError(reply, 'Invalid file name', 400);
      }

      // Bug 68: Validate extension against declared MIME type and reject disguised / double extensions
      const lowerName = rawFileName.toLowerCase();
      const dotParts = lowerName.split('.');
      if (dotParts.length < 2) {
        return sendError(reply, 'File name must include a valid image extension', 400);
      }

      // Check inner extensions for disguised executables/scripts (e.g. shell.php.jpg)
      if (dotParts.length > 2) {
        const innerExtensions = dotParts.slice(1, -1);
        if (innerExtensions.some(ext => DANGEROUS_EXTENSIONS.has(ext))) {
          return sendError(reply, 'Disguised or dangerous file extensions are not allowed', 400);
        }
      }

      const ext = '.' + dotParts[dotParts.length - 1];
      const allowedExts = MIME_EXTENSION_MAP[parsed.data.contentType] || [];
      if (!allowedExts.includes(ext)) {
        return sendError(
          reply,
          `File extension '${ext}' does not match declared content type '${parsed.data.contentType}'`,
          400
        );
      }

      const data = await UploadService.getPresignedUrl(rawFileName, parsed.data.contentType);
      return sendSuccess(reply, data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return sendError(reply, error.errors[0].message, 400);
      }
      return sendError(reply, error.message || 'Failed to generate upload URL', 500);
    }
  });
};

export default uploadRoutes;
