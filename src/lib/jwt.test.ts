import { describe, expect, it } from 'vitest'
import { jwtExpiry } from './jwt'
import { daysLeft, dueThreshold, statusOf } from './expiry'

const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (payload: object) => `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`

describe('jwtExpiry', () => {
  it('reads exp', () => {
    expect(jwtExpiry(jwt({ exp: 1893456000 }))).toBe('2030-01-01T00:00:00.000Z')
  })
  it('accepts a Bearer prefix', () => {
    expect(jwtExpiry(`Bearer ${jwt({ exp: 1893456000 })}`)).toBe('2030-01-01T00:00:00.000Z')
  })
  it('returns null for non-JWT tokens and tokens without exp', () => {
    expect(jwtExpiry('glpat-abcdef')).toBeNull()
    expect(jwtExpiry(jwt({ sub: 'x' }))).toBeNull()
    expect(jwtExpiry('a.b.c')).toBeNull()
  })
})

describe('expiry', () => {
  const now = Date.parse('2026-01-01T12:00:00Z')
  const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString()
  it('classifies status', () => {
    expect(statusOf({ expiresAt: null }, now)).toBe('unknown')
    expect(statusOf({ expiresAt: inDays(-1) }, now)).toBe('expired')
    expect(statusOf({ expiresAt: inDays(5) }, now)).toBe('critical')
    expect(statusOf({ expiresAt: inDays(20) }, now)).toBe('soon')
    expect(statusOf({ expiresAt: inDays(90) }, now)).toBe('ok')
  })
  it('rounds days up', () => {
    expect(daysLeft(inDays(0.5), now)).toBe(1)
  })
  it('picks the smallest reached threshold', () => {
    expect(dueThreshold(inDays(6), [30, 14, 7, 1], now)).toBe(7)
    expect(dueThreshold(inDays(40), [30, 14, 7, 1], now)).toBeNull()
    expect(dueThreshold(inDays(-3), [30, 7, 0], now)).toBe(0)
  })
})
