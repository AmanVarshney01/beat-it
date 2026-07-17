# feedback-juice

## ADDED Requirements

### Requirement: Face deformation is anatomically weighted

Face deformation SHALL vary by facial region derived from face landmarks — soft regions (cheeks, jaw) deform visibly more than stiff regions (forehead) — and each dent SHALL displace surrounding flesh outward in a ring. When landmarks cannot be obtained, the system SHALL fall back to a procedural softness map with the lower face softer.

#### Scenario: Cheek hit squishes more than forehead hit

- **WHEN** equal-strength punches land on the cheek and on the forehead
- **THEN** the cheek deformation is visibly larger than the forehead deformation

#### Scenario: Flesh bulges around the dent

- **WHEN** a punch dents the face
- **THEN** the area surrounding the dent bulges outward before springing back

#### Scenario: Landmarks unavailable

- **WHEN** landmark detection fails on the face bitmap (e.g., manual crop of a non-face)
- **THEN** deformation still works using the procedural softness fallback
