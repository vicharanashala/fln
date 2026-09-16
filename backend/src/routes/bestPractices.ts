import express from 'express';
import { dbStore } from '../db';
import { getAuthUser } from '../auth';

export function registerBestPracticeRoutes(app: express.Express) {
  // Search/list Best Practices Repository (all roles)
  app.get('/api/best-practices', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    let bestPractices = await dbStore.getBestPractices();
    const { search, competency, strategy, sort } = req.query;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      bestPractices = bestPractices.filter(bp =>
        bp.strategyDescription.toLowerCase().includes(q) ||
        bp.teacherName.toLowerCase().includes(q) ||
        bp.weakCompetencies.some(c => c.toLowerCase().includes(q)) ||
        bp.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (competency && typeof competency === 'string') {
      bestPractices = bestPractices.filter(bp => bp.weakCompetencies.includes(competency));
    }
    if (strategy && typeof strategy === 'string') {
      bestPractices = bestPractices.filter(bp => bp.strategyType === strategy);
    }
    if (sort === 'level_jump') {
      bestPractices.sort((a, b) => b.levelJump - a.levelJump);
    } else {
      bestPractices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    res.json(bestPractices);
  });

  // Get single Best Practice (increment view count)
  app.get('/api/best-practices/:id', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const bestPractices = await dbStore.getBestPractices();
    const bp = bestPractices.find(b => b.id === req.params.id);
    if (!bp) return res.status(404).json({ error: 'Best practice not found.' });
    await dbStore.updateBestPractice(bp.id, { viewCount: (bp.viewCount || 0) + 1 });
    res.json({ ...bp, viewCount: (bp.viewCount || 0) + 1 });
  });
}
