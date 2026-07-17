# punch-interaction

## ADDED Requirements

### Requirement: Selectable attack arsenal

The system SHALL offer multiple slapstick attack types — punch, slap, tomato throw, egg throw — selectable from a weapon picker in the scene UI. The selected attack SHALL be used by both the action button and direct taps on the head, and each attack SHALL have a distinct animation, impact physics, and sound. Attacks SHALL remain impact/food-splat slapstick only — no cutting, burning, stabbing, blood, or gore.

#### Scenario: Slap spins the head

- **WHEN** the user selects slap and hits the head
- **THEN** an open hand sweeps in horizontally and the head reacts with a strong sideways spin

#### Scenario: Thrown food splats

- **WHEN** the user selects tomato or egg and targets a point on the head
- **THEN** the projectile arcs in, splats at that point, and applies a soft knock
