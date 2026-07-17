# damage-progression

## ADDED Requirements

### Requirement: Pie and chili marks

The system SHALL paint a cream pie splat at pie impact points and a warm red-orange flush at chili impact points, both located exactly at the hit position, capped alongside existing splat marks, cleared by reset, and visually distinct from bruises (no dark cores; chili flush reads as heat, not injury).

#### Scenario: Pie mark

- **WHEN** a pie lands on the face
- **THEN** a cream splat with crust chips appears at the impact point

#### Scenario: Chili mark

- **WHEN** a chili lands on the face
- **THEN** a diffuse warm red flush appears at the impact point
