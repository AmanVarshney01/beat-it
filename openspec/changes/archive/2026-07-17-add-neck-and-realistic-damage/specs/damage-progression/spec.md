# damage-progression

## MODIFIED Requirements

### Requirement: Cartoon damage accumulates at hit thresholds

The system SHALL paint progressively worsening bruise damage into the face texture at predefined hit-count thresholds, anchored to facial landmarks (eye socket, cheekbone, brow, jaw) when available and to fixed positions relative to the face oval otherwise. Bruising SHALL look realistic (layered discoloration and mottling on the skin) but SHALL remain blood-free — no cuts, blood, or gore. In 3D mode the painted damage SHALL wrap and light with the face mesh.

#### Scenario: Threshold reached

- **WHEN** the hit count crosses a damage threshold
- **THEN** the corresponding bruise is painted into the face texture and persists

#### Scenario: Damage caps out

- **WHEN** the hit count passes the final threshold
- **THEN** all bruises deepen to their maximum intensity and dizzy stars orbit the head, with no further damage added

#### Scenario: Damage stays blood-free

- **WHEN** any damage stage renders
- **THEN** the face shows bruising and swelling only — no blood, cuts, or gore
