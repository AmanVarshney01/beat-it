# game-scene

## ADDED Requirements

### Requirement: Head renders with depth cues

The head SHALL render with 2.5D depth cues: a soft directional highlight, an elliptical rim shadow so the face reads as a rounded dome, and a subtle velocity-based tilt suggesting rotation in depth.

#### Scenario: Head at rest shows depth shading

- **WHEN** the game scene renders the head
- **THEN** the face shows a highlight and rim shadow consistent with a rounded 3D form

#### Scenario: Fast sideways motion tilts the head

- **WHEN** the head moves quickly sideways after a punch
- **THEN** the head narrows slightly along the motion axis, suggesting a turn in depth
