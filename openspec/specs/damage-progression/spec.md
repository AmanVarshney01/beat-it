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

The system SHALL paint damage into the face texture at the exact impact point of each landed attack: impact attacks paint realistic bruises and, when blood spatter is enabled, a compact surface-blood mark; repeated hits near an existing bruise SHALL deepen it instead of stacking a new bruise; food attacks paint food splats. Mark counts are capped, damage persists until reset, and in 3D mode all marks wrap and light with the face mesh. Blood effects SHALL remain bounded surface stains and droplets with no cuts, open wounds, burns, or gore. Hit-count thresholds SHALL continue to drive the max-damage dizzy-stars state.

#### Scenario: Damage appears where the hit lands

- **WHEN** an attack lands at a point on the face
- **THEN** the corresponding mark (bruise or splat) is painted at that point

#### Scenario: Threshold reached

- **WHEN** the hit count crosses the final damage threshold
- **THEN** the dizzy-stars max-damage state activates (mark placement itself is impact-located, not threshold-driven)

#### Scenario: Repeat hits deepen a bruise

- **WHEN** several punches land in the same area
- **THEN** the bruise there grows darker/deeper rather than duplicating

#### Scenario: Different food marks overlap

- **WHEN** tomato and egg land at the same or nearby point
- **THEN** both residue types remain recognizable instead of the newest mark completely hiding the older one

#### Scenario: Damage caps out

- **WHEN** the hit count passes the final threshold
- **THEN** dizzy stars orbit the head and mark caps prevent unbounded painting

#### Scenario: Blood spatter is localized

- **WHEN** blood spatter is enabled and punch, slap, or mallet lands
- **THEN** a compact blood mark is centered at the resolved impact and remains attached to that face region

#### Scenario: Blood spatter is disabled

- **WHEN** blood spatter is disabled and an impact attack lands
- **THEN** bruising still renders but no blood stain or airborne blood droplets are added

#### Scenario: Injury detail remains non-gory

- **WHEN** any damage renders
- **THEN** the game shows bruises, bounded surface blood, or food splats with no cuts, open wounds, burns, or gore

### Requirement: Damage and counters can be reset

The system SHALL provide a reset control that restores the pristine face, clears all overlays, and zeroes the hit and combo counters without requiring a new upload.

#### Scenario: Reset pressed

- **WHEN** the user presses reset
- **THEN** all damage overlays are removed and hit/combo counters return to zero
