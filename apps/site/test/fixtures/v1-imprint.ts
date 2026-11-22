// The text of v1's imprint sections as the page rendered them (tags, line breaks and button chrome removed, white space
// collapsed), taken from `git show origin/v1:apps/web/src/pages/imprint.tsx` at origin/v1 53ad2a3. Its Privacy Policy
// column is not here: /imprint replaces it with one sentence that links /privacy (see legal.site.test.ts).
export const v1ImprintSections: ReadonlyArray<{ heading: string; text: string }> = [
  {
    heading: 'Operated by',
    text: 'Johannes Krumm Munich, Germany Free Planning Poker is a free, open-source, non-commercial project run by a private individual.',
  },
  {
    heading: 'Contact',
    text: 'For privacy reasons, I do not publish a private postal address or email address here. Please use the contact form to reach me — it goes straight to my inbox. I read every message and respond to all genuine enquiries, including data-protection requests. Contact',
  },
  {
    heading: 'Project License',
    text: 'The project is licensed under the GNU Affero General Public License v3.0 (AGPLv3). This license ensures that derivative work is released under the same license terms, promoting open-source sharing and improvement. You can use, modify, and distribute this software and its source code provided you adhere to the license terms. AGPLv3 license',
  },
  {
    heading: 'Donations',
    text: 'The donation link is purely an option for those who voluntarily choose to financially support the continued upkeep and development of this tool. Any funds received are not formal, tax-deductible donations, nor a commercial transaction involving an exchange of goods or services. They are supportive contributions toward the further development of the tool. As such, these arrangements are not governed by the German Civil Code (BGB) or the Consumer Rights Directive (2011/83/EU). The use of the term donation here is common terminology on online platforms and is not linked to the laws and regulations governing formal, registered charity donations. Donate',
  },
]
