'use strict';

const table = 'ref_plant_species';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Bentgrass',
    },
    {
      name: 'Bluegrass, Alkali',
      stubble_height: 8,
    },
    {
      name: 'Bluegrass, Alpine',
      leaf_stage: 2.5,
      stubble_height: 8,
    },
    {
      name: 'Bluegrass, Canada',
      leaf_stage: 2.5,
      stubble_height: 8,
    },
    {
      name: 'Bluegrass, Cusick\'s',
      leaf_stage: 2.5,
      stubble_height: 8,
    },
    {
      name: 'Bluegrass, Fowl',
      leaf_stage: 2.5,
      stubble_height: 8,
    },
    {
      name: 'Bluegrass, Kentucky',
      leaf_stage: 2.5,
      stubble_height: 8,
    },
    {
      name: 'Bluegrass, Sandberg',
      leaf_stage: 2.5,
    },
    {
      name: 'Brome, California',
    },
    {
      name: 'Brome, Fringed',
      leaf_stage: 3,
      stubble_height: 10,
    },
    {
      name: 'Brome, Japanese',
      leaf_stage: 3,
      stubble_height: 10,
    },
    {
      name: 'Brome, Pumpelly',
      leaf_stage: 3,
      stubble_height: 10,
    },
    {
      name: 'Brome, Smooth',
      leaf_stage: 3,
      stubble_height: 10,
    },
    {
      name: 'Cheatgrass',
    },
    {
      name: 'Fescue, Altai',
      leaf_stage: 4.5,
      stubble_height: 17,
    },
    {
      name: 'Fescue, Creeping Red',
      stubble_height: 7,
    },
    {
      name: 'Fescue, Idaho',
      leaf_stage: 4,
      stubble_height: 12,
    },
    {
      name: 'Fescue, Rough',
      leaf_stage: 4.5,
      stubble_height: 17,
    },
    {
      name: 'Fescue, Western',
    },
    {
      name: 'Foxtail Barley',
    },
    {
      name: 'Hairgrass, tufted',
      leaf_stage: 4,
    },
    {
      name: 'Junegrass',
    },
    {
      name: 'Mannagrass',
    },
    {
      name: 'Mat Muhly',
    },
    {
      name: 'Needle-and-thread grass',
      leaf_stage: 3,
      stubble_height: 12,
    },
    {
      name: 'Needlegrass, Columbia',
      leaf_stage: 3,
      stubble_height: 12,
    },
    {
      name: 'Needlegrass, Green',
      stubble_height: 12,
    },
    {
      name: 'Needlegrass, Richardson\'s',
      stubble_height: 12,
    },
    {
      name: 'Needlegrass, Stiff',
      leaf_stage: 3,
      stubble_height: 12,
    },
    {
      name: 'Nuttal\'s alkaligrass',
    },
    {
      name: 'Orchard grass',
      leaf_stage: 3,
      stubble_height: 10,
    },
    {
      name: 'Pinegrass',
      leaf_stage: 2.5,
      stubble_height: 15,
    },
    {
      name: 'Porcupine Grass',
      leaf_stage: 3,
    },
    {
      name: 'Reedgrass, Canada',
      leaf_stage: 3,
    },
    {
      name: 'Reedgrass, Purple',
    },
    {
      name: 'Ricegrass, Indian',
    },
    {
      name: 'Ricegrass, Rough-leaved',
      leaf_stage: 3,
      stubble_height: 8,
    },
    {
      name: 'Saltgrass',
    },
    {
      name: 'Sedge, beaked',
    },
    {
      name: 'Sedge, Field',
    },
    {
      name: 'Sedge, Smooth black',
    },
    {
      name: 'Threeawn',
    },
    {
      name: 'Timber oatgrass',
    },
    {
      name: 'Timothy, Alpine',
      stubble_height: 10,
    },
    {
      name: 'Timothy, domestic',
      stubble_height: 8,
    },
    {
      name: 'Trisetum, nodding',
    },
    {
      name: 'Trisetum, Spike',
    },
    {
      name: 'Wheatgrass, bluebunch',
      leaf_stage: 4,
      stubble_height: 15,
    },
    {
      name: 'Wheatgrass, crested',
      leaf_stage: 3.5,
      stubble_height: 8,
    },
    {
      name: 'Wheatgrass, northern',
      leaf_stage: 5.5,
      stubble_height: 15,
    },
    {
      name: 'Wheatgrass, Slender',
      leaf_stage: 4,
      stubble_height: 15,
    },
    {
      name: 'Wheatgrass, western',
      leaf_stage: 4,
      stubble_height: 12,
    },
    {
      name: 'Wildrye, Blue',
      leaf_stage: 4,
      stubble_height: 15,
    },
    {
      name: 'Wildrye, Canada',
    },
    {
      name: 'Wildrye, Giant',
    },
    {
      name: 'Other',
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
