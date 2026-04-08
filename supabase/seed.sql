-- =============================================================================
-- Tingle Tracker — Seed Data
-- Run after migration: supabase db reset (applies migration + seed automatically)
-- Or manually: psql ... < supabase/seed.sql
-- =============================================================================

-- Trigger tags — curated taxonomy, never modified programmatically
INSERT INTO trigger_tags (label, slug, category, description) VALUES

  -- Aural
  ('Whispering',          'whispering',           'aural',            'Soft, breathy vocal delivery'),
  ('Soft speaking',       'soft-speaking',        'aural',            'Calm, low-volume voice without whispering'),
  ('Tapping',             'tapping',              'aural',            'Rhythmic tapping on surfaces'),
  ('Crinkling',           'crinkling',            'aural',            'Crinkling of plastic, paper, or foil'),
  ('Scratching',          'scratching',           'aural',            'Fingernail or object scratching on surfaces'),
  ('Keyboard typing',     'keyboard-typing',      'aural',            'Mechanical or membrane keyboard sounds'),
  ('Binaural audio',      'binaural',             'aural',            '3D audio recorded with binaural microphones'),
  ('Rain / ambient',      'rain-ambient',         'aural',            'Nature sounds or ambient environmental audio'),
  ('Page turning',        'page-turning',         'aural',            'Slow, deliberate turning of book or magazine pages'),
  ('Liquid sounds',       'liquid-sounds',        'aural',            'Pouring, dripping, or stirring liquids'),
  ('Mouth sounds',        'mouth-sounds',         'aural',            'Tongue clicks, lip smacks, or similar'),
  ('No talking',          'no-talking',           'aural',            'Purely sounds, no voice'),

  -- Visual
  ('Slow hand movements', 'slow-hands',           'visual',           'Deliberate, unhurried hand gestures'),
  ('Close-up shots',      'close-up',             'visual',           'Extreme close-up camera framing'),
  ('Light tracing',       'light-tracing',        'visual',           'Moving light source or tracing light on objects'),
  ('Writing / drawing',   'writing-drawing',      'visual',           'Pen, pencil, or brush on paper'),
  ('Folding',             'folding',              'visual',           'Folding paper, fabric, or other materials'),
  ('Brushing',            'brushing',             'visual',           'Brushing hair, makeup, or surfaces'),
  ('No eye contact',      'no-eye-contact',       'visual',           'Creator does not look directly into camera'),
  ('Eye contact',         'eye-contact',          'visual',           'Creator maintains direct gaze into camera'),
  ('Natural lighting',    'natural-lighting',     'visual',           'Soft, diffused or window-based lighting'),
  ('Roleplay scenario',   'roleplay',             'visual',           'First-person scenario (doctor, stylist, etc.)'),

  -- Tactile Adjacent
  ('Scalp massage sim',   'scalp-massage',        'tactile_adjacent', 'Simulated scalp massage or head touching'),
  ('Ear cleaning sim',    'ear-cleaning',         'tactile_adjacent', 'Simulated ear cleaning or examination'),
  ('Face touching sim',   'face-touching',        'tactile_adjacent', 'Simulated face touching or examination'),
  ('Hair brushing sim',   'hair-brushing',        'tactile_adjacent', 'Simulated hair brushing directed at viewer')

ON CONFLICT (slug) DO NOTHING;
