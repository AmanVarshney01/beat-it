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

