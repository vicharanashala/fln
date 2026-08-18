import express from 'express';
import { dbStore } from '../db';
import { STATES_UTS } from '../geoData';

export function registerGeoRoutes(app: express.Express) {
  app.get('/api/states', (_req, res) => {
    res.json(STATES_UTS.map(s => ({ id: s.code, name: s.name })));
  });

  app.get('/api/districts/by-state/:stateId', (req, res) => {
    const state = STATES_UTS.find(s => s.code.toLowerCase() === req.params.stateId.toLowerCase());
    if (!state) return res.status(404).json({ error: 'Unknown state.' });
    res.json(state.districts.map(d => ({ id: d.code, name: d.name })));
  });

  app.get('/api/blocks/by-district/:districtId', async (req, res) => {
    const districtCode = req.params.districtId.toUpperCase();
    const district = STATES_UTS.flatMap(s => s.districts).find(d => d.code === districtCode);
    if (!district) return res.status(404).json({ error: 'Unknown district.' });

    const schools = await dbStore.getSchools();
    const blockCodes = Array.from(new Set(
      schools.filter(s => s.districtCode === districtCode).map(s => s.blockCode)
    )).sort();

    res.json(blockCodes.map(code => {
      const blockNum = parseInt(code.split('_').pop() || '0', 10);
      return { id: code, name: `${district.name} Block ${blockNum}`, districtId: districtCode };
    }));
  });

  app.get('/api/schools/by-block/:blockId', async (req, res) => {
    const blockCode = req.params.blockId.toUpperCase();
    const schools = await dbStore.getSchools();
    res.json(schools.filter(s => s.blockCode === blockCode));
  });
}
