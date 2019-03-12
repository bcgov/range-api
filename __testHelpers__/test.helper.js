// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Pushan Mitra on 2019-03-07.

export const Config = {
  url: '/api/v1',
  token: `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJFRGI2aUd3Vy10UFdNMzBYeGlfQjhzRUdINGJoY08yVkVMczMzY0Jrc2k4In0.eyJqdGkiOiJkMDkwZjVhZS04YzNmLTQyMDAtYjRmNi02YWZmYjUzZWI5ODMiLCJleHAiOjE1MzY4NzM4MjgsIm5iZiI6MCwiaWF0IjoxNTM2ODczNTI4LCJpc3MiOiJodHRwczovL3Nzby1kZXYucGF0aGZpbmRlci5nb3YuYmMuY2EvYXV0aC9yZWFsbXMvcmFuZ2UiLCJhdWQiOiJteXJhbmdlYmMiLCJzdWIiOiJlOTRiNWJlNi02YzM2LTRmNzYtOTI2ZC00MjE5OGQyMWJkOTkiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJteXJhbmdlYmMiLCJhdXRoX3RpbWUiOjE1MzY4NzM1MjgsInNlc3Npb25fc3RhdGUiOiIyZjk5N2ZiMi1iOWVmLTQ2ODItYTA5Yi03MDg3MDdiMWU2M2EiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbIioiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsibXlyYW5nZWJjIjp7InJvbGVzIjpbIm15cmFfYWRtaW4iXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sIm5hbWUiOiJSYW5nZSBBZG1pbiIsInByZWZlcnJlZF91c2VybmFtZSI6InJhbmdlYWRtaW4iLCJnaXZlbl9uYW1lIjoiUmFuZ2UiLCJmYW1pbHlfbmFtZSI6IkFkbWluIiwiZW1haWwiOiJreXViaW4rMUBmcmVzaHdvcmtzLmlvIn0.HUa3waPAmsK7A9zf6ES0VgjOd2D1M8khdLC_aezqtnGUW5JlmZMqR7UVzhIe-VeSzTKukZXUrij6Okr5swCDcThJlRyQDx0RXTIlVGFWuxrJzgEnCftH2VCx-nBzyu1CwxdnhP8U7DFM5wdLtuy_L6o6kBLnlYMYYbb2Wzv0auGxxahfX8DkNQGil-eHxZeCy6o5V_WapVhP2QEfRO6iEIMYMmcgwH3ym7T-SB98ury3rL8evvOjqsM6QHd0CkSpoYoiGhnAmqfWWIky6_Y7QoZGKJBYOaTCBWQnTjB26Kot20-sfTLl10Jv8YlyIEqalufJG5GnrTJ1jIGXC_m1UQ`
};

const testHelper = {
  routes: {
    users: Config.url + '/user'
  },
  setHeader: (request) => {
    return request.set('Authorization', `Bearer ${Config.token}`);
  }

  i
}

export default testHelper;