import { z } from 'zod';

export const emailCategorySchema = z.object({
  releases: z.boolean(),
  news: z.boolean(),
  maintenance: z.boolean(),
  documents: z.boolean(),
  monthly: z.boolean(),
  tips: z.boolean(),
  offers: z.boolean(),
}).strict();
export type EmailCategories = z.infer<typeof emailCategorySchema>;
export const optionalMarketingCategories = ['releases', 'news', 'tips', 'offers'] as const;

export function emailCategories(stored: unknown, legacyPromotional: boolean): EmailCategories {
  return {
    releases: false, news: false, maintenance: true, documents: true,
    monthly: false, tips: false, offers: legacyPromotional,
    ...emailCategorySchema.partial().catch({}).parse(stored),
  };
}

export function emailCategory(template: string, promotional: boolean): keyof EmailCategories | null {
  if (template === 'monthly_report') return 'monthly';
  if (template === 'release_news' || template === 'app_update' || template === 'android_update') return 'releases';
  if (template === 'feature_news' || template === 'onboarding_guide' || template === 'newsletter_editorial') return 'news';
  if (template === 'auto_tips' || template === 'tires') return 'tips';
  return promotional ? 'offers' : null;
}
