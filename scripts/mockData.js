import { flatten } from 'lodash';

const arr = [1, 2, 3, 4, 5, 6];

export const mockAgreements = flatten(
  arr.map(x => (
    arr.map(y => (
      {
        forest_file_id: `RAN0999${x}${y}`,
        file_status_st: 'A',
        file_type_code: 'E01',
        file_type_desc: 'Grazing Licence',
        org_unit_code: 'TST',
        district_admin_zone: `TEST${x}`,
        legal_effective_dt: '1/1/18',
        initial_expiry_dt: '12/31/23'
      }
    ))
  ))
);
export const mockUsage = flatten(
  arr.map(x => (
    flatten(
      arr.map(y => (
        arr.map(z => (
          {
            forest_file_id: `RAN0999${y}${z}`,
            calendar_year: `${2017 + x}`,
            authorized_use: `${100 * x}`,
            temp_increase: '0',
            total_non_use: '0',
            total_annual_use: `${100 * x}`,
          }
        ))
      ))
    )
  ))
);

export const leslie = {
  client_number: '09999901',
  client_name: 'Leslie Knope',
  username: 'bceid\\leslie.knope'
};
export const tom = {
  client_number: '09999903',
  client_name: 'Tom Haverford',
  username: 'bceid\\tom.haverford'
};
export const andy = {
  client_number: '09999909',
  client_name: 'Andy Dwyer',
  username: 'bceid\\andy.dwyer'
};
export const april = {
  client_number: '09999905',
  client_name: 'April Ludgate',
  username: 'bceid\\april.ludgate'
};
export const ann = {
  client_number: '09999906',
  client_name: 'Ann Perkins',
  username: 'bceid\\ann.perkins'
};
export const nackyu = {
  client_number: '09999910',
  client_name: 'Nackyu Han',
  username: 'bceid\\nackyu711'
};
export const ben = {
  client_number: '09999907',
  client_name: 'Ben Wyatt',
  username: 'bceid\\ben.wyatt'
};
export const ron = {
  client_number: '09999902',
  client_name: 'Ron Swanson',
  username: 'bceid\\ron.swanson'
};
export const chris = {
  client_number: '09999908',
  client_name: 'Chris Traeger',
  username: 'bceid\\chris.traeger'
};

export const users = [leslie, tom, andy, april, ann, nackyu, ben, ron, chris];

export const mockClients = flatten(
  [leslie, ann, tom, april, andy, nackyu].map((client, x) => (
    arr.map(y => (
      {
        forest_file_id: `RAN0999${x + 1}${y}`,
        client_locn_code: '01',
        forest_file_client_type_code: 'A',
        client_number: client.client_number,
        client_name: client.client_name,
        licensee_start_date: '2018-01-01 00:00:00',
      }
    ))
  ))
).concat(
  flatten(
    [ben, ron, chris].map((client, x) => (
      arr.map(y => (
        {
          forest_file_id: `RAN0999${x + 1}${y}`,
          client_locn_code: '01',
          forest_file_client_type_code: 'B',
          client_number: client.client_number,
          client_name: client.client_name,
          licensee_start_date: '2018-01-01 00:00:00',
        }
      ))
    ))
  )
);
