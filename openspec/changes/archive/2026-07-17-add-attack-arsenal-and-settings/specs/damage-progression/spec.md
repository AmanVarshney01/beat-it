# damage-progression

## MODIFIED Requirements

### Requirement: Cartoon damage accumulates at hit thresholds

The system SHALL paint damage into the face texture at the exact impact point of each landed attack: impact attacks (punch, slap) paint realistic blood-free bruises, and repeated hits near an existing bruise SHALL deepen it instead of stacking a new mark; food attacks (tomato, egg) paint food splats. Mark counts are capped, damage persists until reset, and in 3D mode all marks wrap and light with the face mesh. Bruising SHALL remain blood-free — no cuts, blood, or gore. Hit-count thresholds SHALL continue to drive the max-damage dizzy-stars state.

#### Scenario: Damage appears where the hit lands

- **WHEN** an attack lands at a point on the face
- **THEN** the corresponding mark (bruise or splat) is painted at that point

#### Scenario: Threshold reached

- **WHEN** the hit count crosses the final damage threshold
- **THEN** the dizzy-stars max-damage state activates (mark placement itself is impact-located, not threshold-driven)

#### Scenario: Repeat hits deepen a bruise

- **WHEN** several punches land in the same area
- **THEN** the bruise there grows darker/deeper rather than duplicating

#### Scenario: Damage caps out

- **WHEN** the hit count passes the final threshold
- **THEN** dizzy stars orbit the head and mark caps prevent unbounded painting

#### Scenario: Damage stays blood-free

- **WHEN** any damage renders
- **THEN** the face shows bruising and food splats only — no blood, cuts, burns, or gore
