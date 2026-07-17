# punch-interaction

## ADDED Requirements

### Requirement: Weapons render as 3D models with depth

In 3D mode every weapon SHALL render as a 3D model (no emoji): thrown food SHALL fly from the viewer's position into the scene with visible depth and tumble before splatting; melee weapons SHALL swing in as 3D models. In 2D fallback mode, weapons SHALL use rendered model sprites instead of emoji.

#### Scenario: Tomato flies in depth

- **WHEN** the user throws a tomato at the face
- **THEN** a 3D tomato approaches from the viewer, shrinking toward the scene, and splats at the aimed point

### Requirement: Cursor shows the selected weapon

The mouse cursor over the scene SHALL display the currently selected weapon's image.

#### Scenario: Cursor follows selection

- **WHEN** the user selects the mallet
- **THEN** the scene cursor becomes a small mallet image

### Requirement: Noodles attack

The arsenal SHALL include a noodles attack: a clump of noodles drops from above, drapes noodle strands on the head at the impact point and leaves a sauce stain there.

#### Scenario: Noodle mess

- **WHEN** the user lands a noodles attack
- **THEN** noodle strands hang on the head at the impact point and a sauce stain marks the face until reset
