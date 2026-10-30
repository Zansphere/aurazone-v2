import { FastifyPluginAsync } from 'fastify';
import { UploadService } from '../../services/upload.service.js';
import { authenticate } from '../../middleware/auth.js';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../middleware/response.js';

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

      const data = await UploadService.getPresignedUrl(parsed.data.fileName, parsed.data.contentType);
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
