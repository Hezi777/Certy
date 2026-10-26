import type { Service } from './types'

const bearer = { Authorization: 'Bearer {{token}}' }

/**
 * Built-in services. A preset is just a pre-filled custom service, so presets and
 * user-made services share one code path.
 */
export const PRESETS: Service[] = [
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: { kind: 'logo', id: 'gitlab' },
    color: '#FC6D26',
    baseUrl: 'https://gitlab.com',
    check: {
      type: 'api',
      method: 'GET',
      path: '/api/v4/personal_access_tokens/self',
      headers: { 'PRIVATE-TOKEN': '{{token}}' },
      pointer: '/expires_at',
    },
    builtin: true,
    enabled: true,
    hint: 'Personal, project or group access token. Expiry is read from the GitLab API.',
  },
  {
    id: 'airflow',
    name: 'Airflow',
    icon: { kind: 'logo', id: 'airflow' },
    color: '#017CEE',
    baseUrl: 'https://airflow.example.com',
    check: { type: 'ping', method: 'GET', path: '/api/v2/version', headers: bearer, okStatus: [200] },
    builtin: true,
    enabled: true,
    hint: 'Airflow 3 tokens are JWTs, so expiry is read from the token. Use /api/v1/version on Airflow 2.',
  },
  {
    id: 'trino',
    name: 'Trino',
    icon: { kind: 'logo', id: 'trino' },
    color: '#DD00A1',
    baseUrl: 'https://trino.example.com',
    check: { type: 'ping', method: 'GET', path: '/v1/info', headers: bearer, okStatus: [200] },
    builtin: true,
    enabled: true,
    hint: 'JWT tokens expose their expiry. For TLS, track the coordinator certificate instead.',
  },
  {
    id: 'dagshub',
    name: 'DagsHub',
    icon: { kind: 'logo', id: 'dagshub' },
    color: '#4B5563',
    baseUrl: 'https://dagshub.com',
    check: { type: 'ping', method: 'GET', path: '/api/v1/user', headers: bearer, okStatus: [200] },
    builtin: true,
    enabled: true,
    hint: 'Set the expiry date by hand; Certy pings the API to catch revoked tokens.',
  },
  {
    id: 'azuredevops',
    name: 'Azure DevOps',
    icon: { kind: 'logo', id: 'azuredevops' },
    color: '#0078D4',
    baseUrl: 'https://dev.azure.com/your-org',
    check: {
      type: 'ping',
      method: 'GET',
      path: '/_apis/connectionData',
      // PATs use basic auth with an empty user name
      headers: { Authorization: 'Basic {{basic:token}}' },
      okStatus: [200],
    },
    builtin: true,
    enabled: true,
    hint: 'A PAT can’t read its own expiry. Set the date by hand; Certy pings to catch revoked tokens.',
  },
]
