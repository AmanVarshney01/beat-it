# feedback-juice

## ADDED Requirements

### Requirement: Punch impact deforms the face locally

A landed punch SHALL locally deform the face around the impact point (a dent pushed along the punch direction with distance falloff) that elastically springs back within ~0.5s. Deformation SHALL work for both auto-detected and manually-cropped faces.

#### Scenario: Cheek dent on hit

- **WHEN** a punch lands on a point of the head
- **THEN** the face visibly dents around that point and springs back to rest within ~0.5s

#### Scenario: Rest state is undeformed

- **WHEN** no punch has landed recently
- **THEN** the face renders identically to its undeformed bitmap
