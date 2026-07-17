# damage-progression Specification

## Purpose
TBD - created by archiving change build-face-punch-mvp. Update Purpose after archive.
## Requirements
### Requirement: Hits are counted and displayed

The system SHALL count landed punches and display the running total in the scene UI.

#### Scenario: Counter increments

- **WHEN** a punch lands
- **THEN** the hit counter increments by one and the display updates

### Requirement: Rapid hits build a combo

The system SHALL track a combo that increments when punches land within a short window (~1s) of the previous punch, resets when the window lapses, and is displayed with escalating flair.

#### Scenario: Combo grows

- **WHEN** a punch lands within the combo window of the previous punch
- **THEN** the combo count increments and is shown (e.g., "12x COMBO!")

#### Scenario: Combo breaks

- **WHEN** no punch lands within the combo window
- **THEN** the combo resets to zero

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

### Requirement: Damage and counters can be reset

The system SHALL provide a reset control that restores the pristine face, clears all overlays, and zeroes the hit and combo counters without requiring a new upload.

#### Scenario: Reset pressed

- **WHEN** the user presses reset
- **THEN** all damage overlays are removed and hit/combo counters return to zero

### Requirement: Pie and chili marks

The system SHALL paint a cream pie splat at pie impact points and a warm red-orange flush at chili impact points, both located exactly at the hit position, capped alongside existing splat marks, cleared by reset, and visually distinct from bruises (no dark cores; chili flush reads as heat, not injury).

#### Scenario: Pie mark

- **WHEN** a pie lands on the face
- **THEN** a cream splat with crust chips appears at the impact point

#### Scenario: Chili mark

- **WHEN** a chili lands on the face
- **THEN** a diffuse warm red flush appears at the impact point

