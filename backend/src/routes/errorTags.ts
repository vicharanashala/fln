import express from 'express';
import { TOPIC_ERROR_TAGS, getErrorTagsForTopic } from '../errorTags';
import { getAuthUser } from '../auth';

export function registerErrorTagsRoutes(app: express.Express) {
  /**
   * GET /api/error-tags
   * GET /api/error-tags?topic=shapes
   *
   * Exposes the canonical Balvatika error tag taxonomy for question-authoring
   * UI dropdowns and backend validation logic (Issue #626).
   */
  app.get('/api/error-tags', (req: express.Request, res: express.Response) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const topicParam = req.query.topic as string | undefined;

    if (topicParam) {
      const tags = getErrorTagsForTopic(topicParam) as string[] | null;
      if (!tags) {
        return res.status(400).json({
          error: `Unknown topic '${topicParam}'. Supported Balvatika topics: ${Object.keys(TOPIC_ERROR_TAGS).join(', ')}`,
        });
      }
      return res.json({
        success: true,
        topic: topicParam.trim().toLowerCase(),
        tags,
      });
    }

    return res.json({
      success: true,
      errorTags: TOPIC_ERROR_TAGS,
    });
  });
}
