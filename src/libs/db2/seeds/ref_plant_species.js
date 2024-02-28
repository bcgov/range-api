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
      name: "Bluegrass, Cusick's",
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
      name: "Needlegrass, Richardson's",
      stubble_height: 12,
    },
    {
      name: 'Needlegrass, Stiff',
      leaf_stage: 3,
      stubble_height: 12,
    },
    {
      name: "Nuttal's alkaligrass",
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
    {
      name: 'Alder',
      is_shrub_use: true,
    },
    {
      name: 'Antelope-Brush',
      is_shrub_use: true,
    },
    {
      name: 'Birch, bog',
      is_shrub_use: true,
    },
    {
      name: 'Bitterbrush',
      is_shrub_use: true,
    },
    {
      name: 'Ceanothus, Snowbrush',
      is_shrub_use: true,
    },
    {
      name: 'Ceanothus, Redstem',
      is_shrub_use: true,
    },
    {
      name: 'Cherry, Choke',
      is_shrub_use: true,
    },
    {
      name: 'Cherry, Pin',
      is_shrub_use: true,
    },
    {
      name: 'Cinquefoil, Shrubby',
      is_shrub_use: true,
    },
    {
      name: 'Dogwood, Red-osier',
      is_shrub_use: true,
    },
    {
      name: 'Ninebark',
      is_shrub_use: true,
    },
    {
      name: 'Oceanspray',
      is_shrub_use: true,
    },
    {
      name: 'Raspberry sp.',
      is_shrub_use: true,
    },
    {
      name: 'Rose, Prickly',
      is_shrub_use: true,
    },
    {
      name: 'Rose, Woods',
      is_shrub_use: true,
    },
    {
      name: 'Sagebrush, Big',
      is_shrub_use: true,
    },
    {
      name: 'Sagebrush, Prairie',
      is_shrub_use: true,
    },
    {
      name: 'Saskatoon',
      is_shrub_use: true,
    },
    {
      name: 'Snowberry',
      is_shrub_use: true,
    },
    {
      name: 'Sumac',
      is_shrub_use: true,
    },
    {
      name: 'Trembling Aspen',
      is_shrub_use: true,
    },
    {
      name: 'Twinberry, Black',
      is_shrub_use: true,
    },
    {
      name: 'Twinberry, Red',
      is_shrub_use: true,
    },
    {
      name: 'Willow spp',
      is_shrub_use: true,
    },
    {
      name: 'Other',
      is_shrub_use: true,
    },
  ].map((item, index) => ({ ...item, id: index + 1 }));

  await knex(table).delete();
  await knex(table).insert(ref);
};
