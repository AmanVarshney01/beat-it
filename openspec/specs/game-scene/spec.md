# game-scene Specification

## Purpose
TBD - created by archiving change build-face-punch-mvp. Update Purpose after archive.
## Requirements
### Requirement: Scene renders a cartoon dummy with the user's face

The system SHALL render a canvas scene showing a cartoon punching-dummy (head + body) with the user's oval face bitmap composited onto the head.

#### Scenario: Scene starts after face is ready

- **WHEN** a face bitmap has been produced (by detection or manual crop)
- **THEN** the game scene is shown with the face composited on the cartoon head

### Requirement: Head is mounted on a physics spring

The head SHALL be simulated as a physics body tethered to a mount point with a stiff damped constraint, so external impulses produce natural wobble and recoil before returning to rest.

#### Scenario: Head at rest

- **WHEN** no punch has occurred recently
- **THEN** the head settles at its mount position with a subtle idle bob

#### Scenario: Head receives an impulse

- **WHEN** an impulse is applied to the head body
- **THEN** the head recoils, wobbles with damping, and returns to its rest position

### Requirement: Scene runs at interactive frame rate

The render loop SHALL target 60fps and SHALL perform no per-frame image processing (the face bitmap is prepared once at upload time).

#### Scenario: Continuous play

- **WHEN** the scene is active and punches are being thrown
- **THEN** rendering and physics stay smooth, with all face compositing done from the cached bitmap

### Requirement: User can start over with a new face

The system SHALL provide a way to leave the scene and upload a different photo.

#### Scenario: New photo requested

- **WHEN** the user chooses "new face"
- **THEN** the app returns to the upload screen and clears the previous face bitmap and damage state

### Requirement: Scene is immersive with the face as focal point

The game scene SHALL occupy the full viewport (covering app chrome) and SHALL size the head so it is the dominant visual element, with fist and effect sizes scaling proportionally to the head.

#### Scenario: Game starts

- **WHEN** the game scene is shown
- **THEN** it covers the entire viewport and the head's diameter is at least half of the viewport's smaller dimension

#### Scenario: Viewport resized

- **WHEN** the viewport size changes
- **THEN** the head, dummy, and effects rescale so the face remains the dominant element

### Requirement: Head renders with depth cues

The head SHALL render with 2.5D depth cues: a soft directional highlight, an elliptical rim shadow so the face reads as a rounded dome, and a subtle velocity-based tilt suggesting rotation in depth.

#### Scenario: Head at rest shows depth shading

- **WHEN** the game scene renders the head
- **THEN** the face shows a highlight and rim shadow consistent with a rounded 3D form

#### Scenario: Fast sideways motion tilts the head

- **WHEN** the head moves quickly sideways after a punch
- **THEN** the head narrows slightly along the motion axis, suggesting a turn in depth

### Requirement: Head renders as a 3D face mesh when landmarks are available

When face landmarks are found for the face bitmap, the head SHALL render as a lit, textured 3D mesh built from those landmarks (including per-point depth), showing a real face silhouette and visible parallax as the head rotates. Punch impacts SHALL rotate the head in depth (yaw/pitch swing) in addition to the physics knockback, and SHALL dent the 3D mesh at the impact point. When landmarks are not found, the scene SHALL fall back to the 2D oval pipeline.

#### Scenario: 3D head on landmark success

- **WHEN** the game starts with a face whose landmarks were detected
- **THEN** the head renders as a 3D mesh with lighting and a non-oval face silhouette, and punches visibly swing it in depth

#### Scenario: Fallback without landmarks

- **WHEN** the game starts with a face bitmap that yields no landmarks
- **THEN** the scene renders and plays using the 2D warp pipeline

### Requirement: Dummy has a neck

The dummy SHALL connect the head to the torso with a skin-toned neck whose color is sampled from the face image and which follows the head's position and tilt. The underlying physics mount (damped spring behavior) is unchanged.

#### Scenario: Neck follows the head

- **WHEN** the head recoils from a punch
- **THEN** the neck stays visually connected from torso to chin, stretching and tilting with the head

