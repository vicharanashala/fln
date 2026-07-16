import { State } from '../models/state.model';
import { District } from '../models/district.model';
import { Block } from '../models/block.model';
import { School } from '../models/school.model';
import { connectDatabase } from '../config/database';

const geoData: Record<string, { districts: { name: string; code: string; blocks: { name: string; code: string; schools: { name: string; code: string; strength: 'high' | 'low' }[] }[] }[] }> = {
  PB: {
    districts: [
      {
        name: 'Ludhiana', code: 'LDH',
        blocks: [
          { name: 'Ludhiana East', code: 'LDH_E', schools: [{ name: 'Govt High School Ludhiana East', code: 'ghs-ludhiana-east', strength: 'high' }, { name: 'Govt Primary School Ludhiana East', code: 'gps-ludhiana-east', strength: 'low' }] },
          { name: 'Ludhiana West', code: 'LDH_W', schools: [{ name: 'Govt High School Ludhiana West', code: 'ghs-ludhiana-west', strength: 'high' }, { name: 'Govt Middle School Ludhiana West', code: 'gms-ludhiana-west', strength: 'low' }] },
        ],
      },
      {
        name: 'Amritsar', code: 'AMR',
        blocks: [
          { name: 'Amritsar North', code: 'AMR_N', schools: [{ name: 'Govt High School Amritsar North', code: 'ghs-amritsar-north', strength: 'high' }] },
          { name: 'Amritsar South', code: 'AMR_S', schools: [{ name: 'Govt Primary School Amritsar South', code: 'gps-amritsar-south', strength: 'low' }] },
        ],
      },
      {
        name: 'Jalandhar', code: 'JAL',
        blocks: [
          { name: 'Jalandhar City', code: 'JAL_C', schools: [{ name: 'Govt High School Jalandhar', code: 'ghs-jalandhar', strength: 'high' }] },
        ],
      },
    ],
  },
  BR: {
    districts: [
      {
        name: 'Patna', code: 'PAT',
        blocks: [
          { name: 'Patna City', code: 'PAT_C', schools: [{ name: 'Govt High School Patna', code: 'ghs-patna', strength: 'high' }, { name: 'Govt Primary School Patna', code: 'gps-patna', strength: 'low' }] },
          { name: 'Danapur', code: 'DAN', schools: [{ name: 'Govt Middle School Danapur', code: 'gms-danapur', strength: 'low' }] },
        ],
      },
      {
        name: 'Gaya', code: 'GAY',
        blocks: [
          { name: 'Gaya Town', code: 'GAY_T', schools: [{ name: 'Govt High School Gaya', code: 'ghs-gaya', strength: 'high' }] },
        ],
      },
    ],
  },
  MH: {
    districts: [
      {
        name: 'Mumbai', code: 'MUM',
        blocks: [
          { name: 'Mumbai City', code: 'MUM_C', schools: [{ name: 'Govt High School Mumbai', code: 'ghs-mumbai', strength: 'high' }, { name: 'Govt Primary School Mumbai', code: 'gps-mumbai', strength: 'low' }] },
          { name: 'Mumbai Suburban', code: 'MUM_S', schools: [{ name: 'Govt High School Andheri', code: 'ghs-andheri', strength: 'high' }] },
        ],
      },
      {
        name: 'Pune', code: 'PUN',
        blocks: [
          { name: 'Pune City', code: 'PUN_C', schools: [{ name: 'Govt High School Pune', code: 'ghs-pune', strength: 'high' }] },
        ],
      },
      {
        name: 'Nagpur', code: 'NGP',
        blocks: [
          { name: 'Nagpur City', code: 'NGP_C', schools: [{ name: 'Govt High School Nagpur', code: 'ghs-nagpur', strength: 'high' }, { name: 'Govt Primary School Nagpur', code: 'gps-nagpur', strength: 'low' }] },
        ],
      },
    ],
  },
};

async function seedGeoData(): Promise<void> {
  await connectDatabase();

  const stateCodes = Object.keys(geoData);

  for (const code of stateCodes) {
    const state = await State.findOne({ code });
    if (!state) {
      console.warn(`State ${code} not found, skipping`);
      continue;
    }

    console.log(`\n--- Processing ${state.name} ---`);

    for (const d of geoData[code].districts) {
      const existingDistrict = await District.findOne({ code: d.code });
      if (existingDistrict) {
        console.log(`  District ${d.name} already exists, skipping`);
        continue;
      }

      const district = await District.create({ name: d.name, code: d.code, state: state._id, isActive: true });
      console.log(`  ✓ District ${d.name} (${d.code})`);

      for (const b of d.blocks) {
        const existingBlock = await Block.findOne({ code: b.code });
        if (existingBlock) {
          console.log(`    Block ${b.name} already exists, skipping`);
          continue;
        }

        const block = await Block.create({ name: b.name, code: b.code, state: state._id, district: district._id, isActive: true });
        console.log(`    ✓ Block ${b.name} (${b.code})`);

        for (const s of b.schools) {
          const existingSchool = await School.findOne({ code: s.code });
          if (existingSchool) {
            console.log(`      School ${s.name} already exists, skipping`);
            continue;
          }

          await School.create({ name: s.name, code: s.code, state: state._id, district: district._id, block: block._id, strength: s.strength, isActive: true });
          console.log(`      ✓ School ${s.name} (${s.code})`);
        }
      }
    }
  }

  console.log('\n✅ Geo data seeding complete!');
}

const isDirectRun = process.argv[1]?.endsWith('seedGeo.ts');
if (isDirectRun) {
  seedGeoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
