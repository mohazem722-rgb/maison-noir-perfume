# Playback-only test asset

`playback.webm` is a 160 × 288, approximately 1.2-second VP8 clip generated with Canvas and MediaRecorder. It contains only a moving rectangle and is used to test video decoding, frame progression, the no-controls playback configuration, full-hero layering/layout, and CDN-error behavior without depending on the Pinterest CDN.

It is NOT the customer's footage, NOT an alternative creative asset, and is never imported into the production app or served as its video fallback. Tests intercept the original URL and explicitly fulfill it with this fixture. The real supplied MP4 could not be downloaded from this sandbox; no test result claims otherwise.
