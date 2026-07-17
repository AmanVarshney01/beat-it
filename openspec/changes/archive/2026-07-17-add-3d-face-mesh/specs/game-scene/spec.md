# game-scene

## ADDED Requirements

### Requirement: Head renders as a 3D face mesh when landmarks are available

When face landmarks are found for the face bitmap, the head SHALL render as a lit, textured 3D mesh built from those landmarks (including per-point depth), showing a real face silhouette and visible parallax as the head rotates. Punch impacts SHALL rotate the head in depth (yaw/pitch swing) in addition to the physics knockback, and SHALL dent the 3D mesh at the impact point. When landmarks are not found, the scene SHALL fall back to the 2D oval pipeline.

#### Scenario: 3D head on landmark success

- **WHEN** the game starts with a face whose landmarks were detected
- **THEN** the head renders as a 3D mesh with lighting and a non-oval face silhouette, and punches visibly swing it in depth

#### Scenario: Fallback without landmarks

- **WHEN** the game starts with a face bitmap that yields no landmarks
- **THEN** the scene renders and plays using the 2D warp pipeline
