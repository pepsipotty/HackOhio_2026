# Production deployment

Site: https://repone.sengweiyeoh.com
Branch: `rep-one` in `pepsipotty/HackOhio_2026`.
S3 bucket: `sengwei-repone-452383570752` (us-east-1).
CloudFront distribution: `E1MQ3M82Z1QB5K`.

Run `npm test` and `npm run build` before deploying. Upload assets before HTML,
retain earlier hashed assets for existing clients, and invalidate CloudFront:

```sh
aws s3 sync dist/ s3://sengwei-repone-452383570752/ --exclude '*.html' --exclude '.vite/*' --cache-control 'public,max-age=300'
aws s3 cp dist/ s3://sengwei-repone-452383570752/ --recursive --exclude '*' --include '*.html' --cache-control 'public,max-age=300'
aws cloudfront create-invalidation --distribution-id E1MQ3M82Z1QB5K --paths '/*'
```

Verify the live exercise page loads the actual humanoid, plays/scrubs the row,
and highlights muscles. The app is self-contained; the Downloads simulator and
reference MOV are not required by production.

## October 24 checkpoint

Replaced the placeholder apparatus with the detailed gym cable tower and rigged
muscle humanoid. Added muscle highlighting, shared grip alignment, muted materials,
and the video-referenced row cadence. Build, bundle budgets, 41 app tests and
17 simulator physics tests passed, alongside local browser checks. The anatomy,
finger contact and motion are visual approximations. Next: inspect the deployed
exercise page and collect feedback on the motion and grip.
