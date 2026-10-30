// tel: and mailto: hrefs from human-formatted values.

export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const mailHref = (address: string, subject?: string): string =>
  `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
