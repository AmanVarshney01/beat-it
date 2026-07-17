# game-scene

## ADDED Requirements

### Requirement: Scene renders as a lit 3D room

When landmarks are available, the scene SHALL render fully in 3D: a room (floor and back wall), a spotlight casting real shadows from the dummy, a 3D torso, and a skin-tinted 3D neck connecting torso to the face mesh and following the head. Screen shake SHALL be applied as camera motion. The 2D pipeline remains the no-landmarks fallback.

#### Scenario: Room and shadow visible

- **WHEN** the game starts in 3D mode
- **THEN** the dummy stands in a lit room and casts a shadow on the floor

#### Scenario: 3D neck follows recoil

- **WHEN** the head is knocked around
- **THEN** the lit 3D neck stays connected from torso to chin, tilting and stretching with the head
