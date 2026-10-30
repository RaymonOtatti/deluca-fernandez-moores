// Small text formatters shared by the components.

/** 1 → "01": the numbering used in section labels and lists. */
export const pad2 = (n: number): string => String(n).padStart(2, '0');

const percentFormat = new Intl.NumberFormat('es-AR', { style: 'percent' });
/** 0.12 → "12%": percentages in copy go through Intl es-AR, never typed by hand. */
export const percent = (n: number): string => percentFormat.format(n);
