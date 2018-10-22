'use strict';

const table = 'ref_plant_community_type';

exports.seed = async (knex) => {
  const ref = [
    {
      name: 'Alkali saltgrass',
      active: true,
    },
    {
      name: 'Awned sedge',
      active: true,
    },
    {
      name: 'Barclay willow',
      active: true,
    },
    {
      name: 'Beaked sedge',
      active: true,
    },
    {
      name: 'Cattail',
      active: true,
    },
    {
      name: 'Crested Wheat Grass seeded lower grassland',
      active: true,
    },
    {
      name: 'Douglas fir bunchgrass',
      active: true,
    },
    {
      name: 'Douglas fir pinegrass',
      active: true,
    },
    {
      name: 'Great bulrush',
      active: true,
    },
    {
      name: 'Grey leaved willow - glow moss',
      active: true,
    },
    {
      name: 'Kootenay middle grassland',
      active: true,
    },
    {
      name: 'Lodgepole pine pinegrass',
      active: true,
    },
    {
      name: 'Nuttall\'s salt grass',
      active: true,
    },
    {
      name: 'Okanagan lower grassland',
      active: true,
    },
    {
      name: 'Peace aspen forest',
      active: true,
    },
    {
      name: 'Peace grassland',
      active: true,
    },
    {
      name: 'Peace shrubland',
      active: true,
    },
    {
      name: 'Scrub birch',
      active: true,
    },
    {
      name: 'Southern Interior yellow pine forest',
      active: true,
    },
    {
      name: 'Spike rush',
      active: true,
    },
    {
      name: 'Sub-alpine fescue grassland',
      active: true,
    },
    {
      name: 'Sub-alpine tall forb',
      active: true,
    },
    {
      name: 'Thompson Nicola lower grassland',
      active: true,
    },
    {
      name: 'Thompson Nicola middle grassland',
      active: true,
    },
    {
      name: 'Thompson Nicola upper grassland',
      active: true,
    },
    {
      name: 'Tufted hairgrass',
      active: true,
    },
    {
      name: 'Other',
      active: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
