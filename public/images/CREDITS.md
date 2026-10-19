# Image provenance and quality

## User-supplied backdrop

- `silver-wave-original.png`: byte-for-byte copy of the supplied attachment (800 × 448 pixels). This is the resolution available in this workspace; it is not claimed to be a 4K source.
- `silver-wave-inverted.png`: exact RGB inversion of the supplied image at the original dimensions. Each color channel is `255 - original`; no resizing, denoising, JPEG compression, or sharpening is applied.
- `silver-wave-seamless-lossless.webp`: 1600 × 896 repeat tile built by mirroring four copies of the inverted source. This is a repeat pattern, **not additional image detail or upscaling**. Lossless WebP preserves every pixel. CSS sizes the tile according to device pixel ratio so one texture pixel maps to one device pixel rather than stretching the 800px artwork across a large screen. The backdrop stays fixed and is hidden by the solid black home hero.
- The source intentionally contains grain. A genuinely larger source is required if the exact single-wave composition must fill a large/4K screen without repetition or magnification.

## Original brand product photograph

- Brand page: https://www.tomfordbeauty.com/collections/fragrance
- Original source image: https://www.tomfordbeauty.com/cdn/shop/files/tf_sku_T1XG01_2000x2000_0_c1902bab-fc8c-4950-b51e-b42bb9bf2e67.png?v=1792341194&width=2000
- Product: Tom Ford Oud Wood Eau de Parfum **100ml**. The product label remains intact.
- Original image dimensions: 2000 × 2000 RGBA. Native bottle alpha bounds are 838 × 1598. Only excess transparent padding was cropped, leaving 16 pixels of padding per side: the delivered bottle file is **870 × 1630**. The bottle itself was never resized or AI-upscaled.
- `oud-wood-100ml-original.png`: lossless, native-resolution crop with the brand's original transparent background.
- `oud-wood-100ml-lossless.webp`: pixel-identical lossless WebP of the PNG, selected by `<picture>` with PNG fallback. No manual white-background removal, blur, cosmetic sharpening, filters, lossy quality setting, or generated detail is applied.
- CSS caps the rendered image by native resolution and device pixel ratio, including Retina displays. New versioned filenames avoid reusing the old low-resolution image from browser cache.
- Commercial reuse rights for the third-party brand photo have not been verified; replace with merchant-owned/licensed photography before public commercial deployment. This is not a photograph of Maison Noir packaging.

Other campaign/category JPG images are illustrative AI-generated assets, as documented in the project README.

## Studio spotlight composition

The latest user-supplied black spotlight reference informed the hero's lighting composition. Its low-resolution raster is not enlarged: CSS gradients render the overhead source, soft light falloff, and floor pool independently of screen resolution. An additional screen-blended gradient is alpha-masked to the original product silhouette, aligned exactly with the image on desktop and mobile. This is non-destructive CSS relighting, not new photographic detail. The source PNG/WebP files and their pixel fidelity remain unchanged.

## Customer-provided external video

Direct source supplied by the customer: https://v1.pinimg.com/videos/iht/720p/f9/ea/c2/f9eac2df7c642573229dd098ba61d13f.mp4 . The app streams this URL without downloading or altering the original file. Actual video contents, resolution, duration, and commercial reuse rights were not verified: the source could not be fetched from this sandbox. The customer identifies this clip as sparks. It now covers the home hero behind the permanent bottle photograph and studio lighting; aspect ratio is preserved with `object-fit: cover`, which may crop edges. This full-hero scaling does not add original detail or constitute a verified HD claim. No pause/native controls are shown, as explicitly requested. Before commercial launch, obtain permission and an authorized merchant-hosted copy rather than relying on third-party hotlink availability. The separate test playback fixture is not this footage and is never used in production.
