/**
 * schema.org FAQPage as a typed object. https://schema.org/FAQPage. Google shows no FAQ rich result since 2026-05-07; the
 * owner's ruling of 2026-11-20 keeps the markup (docs/v9/STRATEGY.md, Rulings of gate 1). Only questions.astro builds
 * it, from the array it prints, so the markup never says what the page does not.
 */

export type QuestionInput = { question: string; answer: string }

export type FaqPageData = {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  mainEntity: {
    '@type': 'Question'
    name: string
    acceptedAnswer: { '@type': 'Answer'; text: string }
  }[]
}

export function faqPage(questions: readonly QuestionInput[]): FaqPageData {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}
