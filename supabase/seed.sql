-- =============================================================================
-- Tingle Tracker — Seed Data
-- Run after migration: supabase db reset (applies migration + seed automatically)
-- Or manually: psql ... < supabase/seed.sql
-- =============================================================================

-- Trigger tags — curated taxonomy, never modified programmatically
INSERT INTO trigger_tags (label, slug, category, description, display_group) VALUES

  -- Aural
  ('Whispering',          'whispering',           'aural',            'Soft, breathy vocal delivery', 'vocal_style'),
  ('Soft speaking',       'soft-speaking',        'aural',            'Calm, low-volume voice without whispering', 'vocal_style'),
  ('Tapping',             'tapping',              'aural',            'Rhythmic tapping on surfaces', 'sensory'),
  ('Crinkling',           'crinkling',            'aural',            'Crinkling of plastic, paper, or foil', 'sensory'),
  ('Scratching',          'scratching',           'aural',            'Fingernail or object scratching on surfaces', 'sensory'),
  ('Keyboard typing',     'keyboard-typing',      'aural',            'Mechanical or membrane keyboard sounds', 'sensory'),
  ('Binaural audio',      'binaural',             'aural',            '3D audio recorded with binaural microphones', 'sensory'),
  ('Rain / ambient',      'rain-ambient',         'aural',            'Nature sounds or ambient environmental audio', 'ambience'),
  ('Page turning',        'page-turning',         'aural',            'Slow, deliberate turning of book or magazine pages', 'sensory'),
  ('Liquid sounds',       'liquid-sounds',        'aural',            'Pouring, dripping, or stirring liquids', 'sensory'),
  ('Mouth sounds',        'mouth-sounds',         'aural',            'Tongue clicks, lip smacks, or similar', 'sensory'),
  ('No talking',          'no-talking',           'aural',            'Purely sounds, no voice', 'sensory'),

  -- Visual
  ('Slow hand movements', 'slow-hands',           'visual',           'Deliberate, unhurried hand gestures', 'sensory'),
  ('Close-up shots',      'close-up',             'visual',           'Extreme close-up camera framing', 'sensory'),
  ('Light tracing',       'light-tracing',        'visual',           'Moving light source or tracing light on objects', 'sensory'),
  ('Writing / drawing',   'writing-drawing',      'visual',           'Pen, pencil, or brush on paper', 'sensory'),
  ('Folding',             'folding',              'visual',           'Folding paper, fabric, or other materials', 'sensory'),
  ('Brushing',            'brushing',             'visual',           'Brushing hair, makeup, or surfaces', 'sensory'),
  ('No eye contact',      'no-eye-contact',       'visual',           'Creator does not look directly into camera', 'sensory'),
  ('Eye contact',         'eye-contact',          'visual',           'Creator maintains direct gaze into camera', 'sensory'),
  ('Natural lighting',    'natural-lighting',     'visual',           'Soft, diffused or window-based lighting', 'sensory'),
  ('Roleplay scenario',   'roleplay',             'visual',           'First-person scenario (doctor, stylist, etc.)', 'style_genre'),

  -- Tactile Adjacent
  ('Scalp massage sim',   'scalp-massage',        'tactile_adjacent', 'Simulated scalp massage or head touching', 'sensory'),
  ('Ear cleaning sim',    'ear-cleaning',         'tactile_adjacent', 'Simulated ear cleaning or examination', 'sensory'),
  ('Face touching sim',   'face-touching',        'tactile_adjacent', 'Simulated face touching or examination', 'sensory'),
  ('Hair brushing sim',   'hair-brushing',        'tactile_adjacent', 'Simulated hair brushing directed at viewer', 'sensory'),

  -- Style / genre (listener search)
  ('Personal attention',  'personal-attention',   'visual',           'Direct-to-viewer care, attention, or pampering framing', 'style_genre'),
  ('Guided relaxation',   'guided-relaxation',   'aural',            'Verbal guidance through breathing, body scan, or relaxation', 'style_genre'),
  ('Sleep aid',           'sleep-aid',            'aural',            'Content framed to help the viewer fall asleep', 'style_genre'),

  -- Vocal (additional)
  ('Inaudible whispering', 'inaudible-whispering', 'aural',           'Mouth movement or breathy texture with unintelligible or absent words', 'vocal_style'),

  -- Music
  ('Background music',    'background-music',     'aural',            'Noticeable instrumental or ambient music bed under the ASMR', 'music'),
  ('No background music', 'no-background-music',  'aural',            'Voice and trigger sounds only; no music bed detected', 'music'),

  -- ASMR Index-informed trigger coverage
  ('Cranial nerve exam',  'cranial-nerve-exam',   'visual',           'Neurology or sensory-check roleplay with close personal attention', 'style_genre'),
  ('Dentist roleplay',    'dentist-roleplay',     'visual',           'Dental checkup or treatment roleplay scenario', 'style_genre'),
  ('Ear cupping',         'ear-cupping',          'tactile_adjacent', 'Cupping palms/hands around ears or microphones for pressure-like effects', 'sensory'),
  ('Hair play',           'hair-play',            'tactile_adjacent', 'Hair-focused handling such as touching, sorting, or combing as the primary trigger', 'sensory'),
  ('Haircut roleplay',    'haircut-roleplay',     'visual',           'Barber or salon haircut-focused roleplay', 'style_genre'),
  ('Interview roleplay',  'interview-roleplay',   'visual',           'Questionnaire/interview-style personal-attention roleplay', 'style_genre'),
  ('Hand movements',      'hand-movements',       'visual',           'Visible hand choreography as a primary visual trigger', 'sensory'),
  ('Sticky sounds',       'sticky-sounds',        'aural',            'Glue-like, adhesive, or tacky peeling and pulling sounds', 'sensory')

ON CONFLICT (slug) DO NOTHING;

-- LLM slug aliases (normalized keys: lowercase, hyphens; resolver also maps underscores)
INSERT INTO trigger_tag_aliases (alias_slug, trigger_tag_id)
SELECT x.alias, t.id FROM trigger_tags t
JOIN (VALUES
  ('soft_spoken', 'soft-speaking'),
  ('softspoken', 'soft-speaking'),
  ('soft_spoken_voice', 'soft-speaking'),
  ('role_play', 'roleplay'),
  ('role-play', 'roleplay'),
  ('roleplay_scenario', 'roleplay'),
  ('close_up', 'close-up'),
  ('closeup', 'close-up'),
  ('slow_hand_movements', 'slow-hands'),
  ('slow_hands', 'slow-hands'),
  ('rain_ambient', 'rain-ambient'),
  ('rain_ambience', 'rain-ambient'),
  ('keyboard_typing', 'keyboard-typing'),
  ('liquid_sounds', 'liquid-sounds'),
  ('mouth_sounds', 'mouth-sounds'),
  ('no_talking', 'no-talking'),
  ('page_turning', 'page-turning'),
  ('light_tracing', 'light-tracing'),
  ('writing_drawing', 'writing-drawing'),
  ('natural_lighting', 'natural-lighting'),
  ('no_eye_contact', 'no-eye-contact'),
  ('eye_contact', 'eye-contact'),
  ('scalp_massage', 'scalp-massage'),
  ('ear_cleaning', 'ear-cleaning'),
  ('face_touching', 'face-touching'),
  ('hair_brushing', 'hair-brushing'),
  ('personal_attention', 'personal-attention'),
  ('guided_relaxation', 'guided-relaxation'),
  ('sleep_aid', 'sleep-aid'),
  ('inaudible_whisper', 'inaudible-whispering'),
  ('inaudible_whispering', 'inaudible-whispering'),
  ('background_music', 'background-music'),
  ('no_background_music', 'no-background-music'),
  ('binaural_audio', 'binaural')
) AS x(alias, canon) ON t.slug = x.canon
ON CONFLICT (alias_slug) DO NOTHING;

-- ASMR Index-informed aliases
INSERT INTO trigger_tag_aliases (alias_slug, trigger_tag_id)
SELECT x.alias, t.id FROM trigger_tags t
JOIN (VALUES
  ('cne', 'cranial-nerve-exam'),
  ('cranial_nerve_exam', 'cranial-nerve-exam'),
  ('cranial-nerve', 'cranial-nerve-exam'),
  ('neurological_exam', 'cranial-nerve-exam'),
  ('neurological-exam', 'cranial-nerve-exam'),
  ('dentist', 'dentist-roleplay'),
  ('dental_exam', 'dentist-roleplay'),
  ('dental-exam', 'dentist-roleplay'),
  ('dental-checkup', 'dentist-roleplay'),
  ('ear_cupping', 'ear-cupping'),
  ('ear-cup', 'ear-cupping'),
  ('hair_play', 'hair-play'),
  ('playing_with_hair', 'hair-play'),
  ('haircut', 'haircut-roleplay'),
  ('barber_haircut', 'haircut-roleplay'),
  ('barbershop_haircut', 'haircut-roleplay'),
  ('interview', 'interview-roleplay'),
  ('interview_roleplay', 'interview-roleplay'),
  ('questionnaire_roleplay', 'interview-roleplay'),
  ('questionnaire', 'interview-roleplay'),
  ('hand_movement', 'hand-movements'),
  ('handmovement', 'hand-movements'),
  ('hand_motion', 'hand-movements'),
  ('sticky_sound', 'sticky-sounds'),
  ('sticky', 'sticky-sounds'),
  ('mouth_sound', 'mouth-sounds'),
  ('mouth-noises', 'mouth-sounds'),
  ('soft_spoken_voiceover', 'soft-speaking'),
  ('soft-voice', 'soft-speaking'),
  ('ear_to_ear', 'binaural'),
  ('ear-to-ear', 'binaural'),
  ('haircut_roleplay', 'haircut-roleplay'),
  ('doctor_roleplay', 'roleplay'),
  ('medical_roleplay', 'roleplay'),
  ('makeup_roleplay', 'roleplay')
) AS x(alias, canon) ON t.slug = x.canon
ON CONFLICT (alias_slug) DO NOTHING;
