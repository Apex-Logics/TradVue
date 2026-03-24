const express = require('express')
const { createClient } = require('@supabase/supabase-js')
const { verifyBadgeSignature } = require('../services/badgeService')

const router = express.Router()

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

router.get('/:hash', async (req, res) => {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('verified_badges')
      .select('id, verify_hash, payload, signature, status, template, created_at')
      .eq('verify_hash', req.params.hash)
      .maybeSingle()

    if (error || !data) return res.status(404).json({ valid: false, error: 'Badge not found' })

    const valid = data.status === 'active' && verifyBadgeSignature(data.payload, data.signature)

    return res.json({
      valid,
      badge: {
        id: data.id,
        verifyHash: data.verify_hash,
        template: data.template,
        createdAt: data.created_at,
        ...data.payload,
      },
    })
  } catch (err) {
    console.error('[Verify] error:', err.message)
    return res.status(500).json({ valid: false, error: 'Internal server error' })
  }
})

module.exports = router
