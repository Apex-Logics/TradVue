const express = require('express')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const { requireAuth } = require('../middleware/auth')
const {
  signBadgePayload,
  verifyBadgeSignature,
  hashPayload,
  buildPeriodRange,
  aggregateEligibleTrades,
  renderBadgeSvg,
} = require('../services/badgeService')

const router = express.Router()

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

router.post('/generate', requireAuth, async (req, res) => {
  try {
    const period = buildPeriodRange(req.body || {})
    const supabase = getSupabase()

    const { data: journalRow, error: journalError } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', req.user.id)
      .eq('data_type', 'journal')
      .maybeSingle()

    if (journalError) return res.status(500).json({ error: 'Failed to load journal data' })

    const trades = journalRow?.data?.trades || []
    const aggregated = aggregateEligibleTrades(trades, period)

    if (!aggregated.summary.tradeCount) {
      return res.status(400).json({
        error: 'No eligible verified trades found for that period. Only CSV-imported or auto-synced/webhook trades qualify.',
      })
    }

    const payload = {
      traderDisplayName: req.body.displayName || req.user.name || 'TradVue Trader',
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      netPnl: aggregated.summary.netPnl,
      winRate: aggregated.summary.winRate,
      tradeCount: aggregated.summary.tradeCount,
      generatedAt: new Date().toISOString(),
      sourceRules: ['csv', 'webhook'],
    }

    const signed = signBadgePayload(payload)
    const verifyHash = hashPayload({ ...payload, userId: req.user.id, key: period.key })
    const imageSvg = renderBadgeSvg({ ...payload, verifyHash })
    const badgeId = crypto.randomUUID()

    const { error: insertError } = await supabase
      .from('verified_badges')
      .insert({
        id: badgeId,
        user_id: req.user.id,
        verify_hash: verifyHash,
        template: req.body.template || 'dark',
        period_key: period.key,
        payload,
        signature: signed.signature,
        image_svg: imageSvg,
        status: 'active',
      })

    if (insertError) return res.status(500).json({ error: 'Failed to save badge' })

    return res.status(201).json({
      badge: {
        id: badgeId,
        verifyHash,
        verifyUrl: `https://www.tradvue.com/verify/${verifyHash}`,
        imageUrl: `https://www.tradvue.com/api/badges/${badgeId}/image`,
        signatureValid: verifyBadgeSignature(payload, signed.signature),
        ...payload,
      },
    })
  } catch (err) {
    console.error('[Badges] generate error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('verified_badges')
      .select('id, verify_hash, template, payload, status, created_at')
      .eq('id', req.params.id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Badge not found' })
    return res.json({ badge: data })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:id/image', async (req, res) => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('verified_badges')
      .select('image_svg')
      .eq('id', req.params.id)
      .single()

    if (error || !data?.image_svg) return res.status(404).json({ error: 'Badge image not found' })
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.send(data.image_svg)
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
