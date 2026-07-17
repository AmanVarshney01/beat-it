# game-scene

## ADDED Requirements

### Requirement: Dummy has a neck

The dummy SHALL connect the head to the torso with a skin-toned neck whose color is sampled from the face image and which follows the head's position and tilt. The underlying physics mount (damped spring behavior) is unchanged.

#### Scenario: Neck follows the head

- **WHEN** the head recoils from a punch
- **THEN** the neck stays visually connected from torso to chin, stretching and tilting with the head
