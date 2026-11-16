# Premium settings and SEO images — 16 November 2026

The account settings presentation is reorganized into personal profile, secure email/password panels, notification switches, privacy/sessions/data export and a distinct account-deletion section. The deletion confirmation dialog is styled separately. Existing save, verification, identity and deletion mechanisms are preserved.

Validation: TypeScript, ESLint and production build passed. 21 focused account, localization and SEO tests passed. An actual headless browser rendered the real settings component with synthetic account data at 1440, 1024, 390 and 360 px in Romanian/English. No overlapping cards or horizontal overflow were detected before/after opening forms. Email-request UI, password mismatch rejection, password visibility, session-list display and opening the deletion confirmation were verified without mutating a production account. These checks are not physical Android testing.

Social share images are PNG 1200×630, rendered with the existing AutoCare app icon and branded document illustration. Romanian and English images have separate URLs. Metadata uses language-appropriate image URLs and locales, and the sitemap exposes the existing brand image alongside the icon. An illustration was removed from the SoftwareApplication screenshot field so it is not represented as a real screenshot. The image is format-converted server-side for correct rendering. Favicons, canonical/hreflang and the existing Search Console verification remain in place.

SEO metadata and image preparation do not guarantee Google rankings or a particular thumbnail. Google chooses whether and when to index and show them. The Search Console sitemap is https://www.autocareapp.ro/sitemap.xml.
