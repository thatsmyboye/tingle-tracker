-- =============================================================================
-- Expand trigger taxonomy + aliases based on ASMR Index category patterns
-- =============================================================================

-- Canonical trigger tags (add only semantically distinct concepts)
INSERT INTO trigger_tags (label, slug, category, description, display_group) VALUES
  ('Cranial nerve exam', 'cranial-nerve-exam', 'visual', 'Clinical-style cranial nerve testing roleplay with close checks and guided tasks', 'style_genre'),
  ('Dentist roleplay', 'dentist-roleplay', 'visual', 'Dental exam or treatment roleplay with close-up personal attention', 'style_genre'),
  ('Ear cupping', 'ear-cupping', 'tactile_adjacent', 'Cupping or pressure effects around the ears for immersive ear-focused sensations', 'sensory'),
  ('Haircut roleplay', 'haircut-roleplay', 'visual', 'Haircut simulation or barber styling sequence directed at the viewer', 'style_genre'),
  ('Hair play', 'hair-play', 'visual', 'Visual hair manipulation and repetitive hair-focused motions', 'sensory'),
  ('Interview roleplay', 'interview-roleplay', 'visual', 'Question-and-response interview style scenario with direct personal attention', 'style_genre'),
  ('Hand movements', 'hand-movements', 'visual', 'Fast or slow layered hand gestures near camera/mic for visual tingles', 'sensory'),
  ('Sticky sounds', 'sticky-sounds', 'aural', 'Adhesive, tacky, or peeling textures that create sticky sound signatures', 'sensory')
ON CONFLICT (slug) DO NOTHING;

-- Alias expansion for higher recall from titles/hashtags/model outputs
INSERT INTO trigger_tag_aliases (alias_slug, trigger_tag_id)
SELECT x.alias, t.id FROM trigger_tags t
JOIN (VALUES
  ('ear-to-ear', 'binaural'),
  ('ear to ear', 'binaural'),
  ('ear_to_ear', 'binaural'),
  ('binaural-audio', 'binaural'),
  ('soft spoken', 'soft-speaking'),
  ('softspoken', 'soft-speaking'),
  ('soft-spoken', 'soft-speaking'),
  ('mouthsounds', 'mouth-sounds'),
  ('mouth-sound', 'mouth-sounds'),
  ('mouth sounds', 'mouth-sounds'),
  ('mouth_sounds', 'mouth-sounds'),
  ('no talking', 'no-talking'),
  ('no_talking', 'no-talking'),
  ('hand movement', 'hand-movements'),
  ('handmovement', 'hand-movements'),
  ('hand movements', 'hand-movements'),
  ('hand_movements', 'hand-movements'),
  ('hairplay', 'hair-play'),
  ('hair play', 'hair-play'),
  ('hair_play', 'hair-play'),
  ('hair-cut', 'haircut-roleplay'),
  ('hair cut', 'haircut-roleplay'),
  ('hair_cut', 'haircut-roleplay'),
  ('barber', 'haircut-roleplay'),
  ('barbershop', 'haircut-roleplay'),
  ('barber-shop', 'haircut-roleplay'),
  ('cranial nerve exam', 'cranial-nerve-exam'),
  ('cranial-nerve', 'cranial-nerve-exam'),
  ('cne', 'cranial-nerve-exam'),
  ('neurological exam', 'cranial-nerve-exam'),
  ('dentist roleplay', 'dentist-roleplay'),
  ('dental exam', 'dentist-roleplay'),
  ('dental roleplay', 'dentist-roleplay'),
  ('ear cupping', 'ear-cupping'),
  ('earcup', 'ear-cupping'),
  ('ear_cupping', 'ear-cupping'),
  ('interview roleplay', 'interview-roleplay'),
  ('job interview', 'interview-roleplay'),
  ('sticky sounds', 'sticky-sounds'),
  ('sticky-sound', 'sticky-sounds'),
  ('sticky', 'sticky-sounds')
) AS x(alias, canon) ON t.slug = x.canon
ON CONFLICT (alias_slug) DO NOTHING;
