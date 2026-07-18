## MODIFIED Requirements

### Requirement: Cartoon damage accumulates at hit thresholds

The system SHALL place bruises, optional bounded surface-blood marks, and food residue from the resolved contact UV and SHALL keep them registered to the same face region while the head rotates and deforms. Repeated impacts near an existing bruise SHALL deepen it instead of stacking a new bruise. Mark counts SHALL be capped, residue SHALL persist until reset, and threshold counts SHALL continue to drive max-damage dizzy stars.

#### Scenario: Damage appears where the hit lands

- **WHEN** an attack resolves a valid face contact
- **THEN** its bruise or food residue is centered on the resolved UV and remains visually attached through subsequent head motion

#### Scenario: Egg breaks visibly at the selected point

- **WHEN** an egg contacts the selected face triangle
- **THEN** recognizable albumen, yolk, and shell residue is centered on that triangle's interpolated UV and persists until reset

#### Scenario: Different food marks overlap

- **WHEN** tomato and egg land at the same or nearby face UVs
- **THEN** both foods remain recognizable while each mark stays centered on its resolved contact

#### Scenario: Deformed contact

- **WHEN** residue is created while the face is dented
- **THEN** it is stored in face texture/surface coordinates and does not slide when the mesh recovers

#### Scenario: Threshold reached

- **WHEN** the hit count crosses the final damage threshold
- **THEN** the dizzy-stars max-damage state activates independently of located residue placement

#### Scenario: Repeat hits deepen a bruise

- **WHEN** several punches resolve near the same face UV
- **THEN** the bruise there grows darker/deeper rather than duplicating

#### Scenario: Damage caps out

- **WHEN** hit count and attacks exceed the configured mark limits
- **THEN** the oldest or merged marks are recycled and memory/paint time remain bounded

#### Scenario: Rapid damage painting

- **WHEN** many attacks add or deepen marks in quick succession
- **THEN** each accepted hit paints only its changed mark instead of reconstructing every historical blurred mark, with no progressive frame-time slowdown

#### Scenario: Blood spatter stays at the resolved contact

- **WHEN** blood spatter is enabled and an impact attack resolves a valid face contact
- **THEN** its compact surface mark is centered on the resolved UV and directional droplets originate from the corresponding visible contact

#### Scenario: Blood spatter is independently disabled

- **WHEN** blood spatter is disabled and an impact attack resolves
- **THEN** bruising and other enabled feedback continue without adding blood marks or droplets

#### Scenario: Damage remains non-gory

- **WHEN** any damage or residue renders
- **THEN** the face shows bruising, bounded surface blood, tomato pulp, egg residue, or physical debris with no cuts, open wounds, burns, or gore

### Requirement: Damage and counters can be reset

The system SHALL provide one reset operation that restores the pristine face, clears counters and all residue, removes active attacks, resets deformation/camera/physics state, and releases transient instances without requiring a new upload.

#### Scenario: Reset pressed at rest

- **WHEN** the user presses reset after multiple attacks
- **THEN** all texture marks, mesh residue, particles, dizzy stars, counters, and deformation are cleared and the pristine scene returns

#### Scenario: Reset pressed during contact

- **WHEN** the user presses reset while an attack is active
- **THEN** no weapon, projectile, sound loop, camera impulse, particle, or scene node remains orphaned after reset
