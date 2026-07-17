# face-upload

## ADDED Requirements

### Requirement: User can provide a face image

The system SHALL let the user provide an image via a file picker or drag-and-drop, accepting common image formats (JPEG, PNG, WebP).

#### Scenario: Image selected via picker

- **WHEN** the user selects a valid image file from the picker
- **THEN** the image is loaded into the browser and face detection begins

#### Scenario: Image dropped onto the page

- **WHEN** the user drags an image file onto the drop zone
- **THEN** the image is loaded into the browser and face detection begins

#### Scenario: Unsupported file provided

- **WHEN** the user provides a non-image file
- **THEN** the system shows a friendly error and remains on the upload screen

### Requirement: Face detection runs entirely client-side

The system SHALL perform face detection in the browser using MediaPipe and SHALL NOT transmit the image (or any derivative of it) over the network.

#### Scenario: Detection succeeds locally

- **WHEN** an image containing a face is provided
- **THEN** the face bounding box and eye keypoints are computed in-browser with no network request containing image data

### Requirement: Detected face is cropped to an oval cutout

The system SHALL crop the detected face region, apply an oval alpha mask with a cartoon outline, and produce a reusable face bitmap oriented using the eye keypoints.

#### Scenario: Face found

- **WHEN** detection returns at least one face
- **THEN** the highest-confidence face is cropped to an oval bitmap and the app proceeds to the game scene

#### Scenario: Tilted face

- **WHEN** the detected face is rotated in the source photo
- **THEN** the crop is rotated using the eye keypoints so the eyes are level in the cutout

### Requirement: Manual crop fallback when no face is found

The system SHALL offer a manual oval-crop tool when detection finds no face, so the user can position and scale the oval themselves.

#### Scenario: No face detected

- **WHEN** detection returns zero faces
- **THEN** the system shows a "couldn't find a face" message and opens the manual oval-crop tool over the uploaded image

#### Scenario: Manual crop confirmed

- **WHEN** the user positions the oval and confirms
- **THEN** the cropped region becomes the face bitmap and the app proceeds to the game scene
