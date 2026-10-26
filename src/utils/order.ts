import type { Order, OrderShop } from '@/api';
import { formatDays, formatDayShort } from '@/utils/dates';
import { formatCiPhone } from '@/utils/phone';

/**
 * "Boutique Koné Électro prépare « Ventilateur… ». Livraison prévue sous 24 à 48 h à Cocody."
 * Non-breaking spaces inside « » (French typography): the quote marks never sit alone on a line.
 */
export function trackingText(s: OrderShop, o: Order): string {
  const sale = s.lines.filter((l) => !l.rental);
  const rentals = s.lines.filter((l) => l.rental);
  const parts: string[] = [];

  if (sale.length > 0) {
    const units = sale.reduce((n, l) => n + l.quantity, 0);
    const what = units === 1 ? `«\u00A0${sale[0].name}\u00A0»` : `vos ${units} articles`;
    if (s.delivery.kind === 'home') {
      const commune = o.customer.address.split(',')[0].trim();
      // detail looks like "≈ 29 km · 24–48 h": keep only the delay.
      const delay = (s.delivery.detail.split('·').pop() ?? '').trim().replace('–', ' à ');
      parts.push(`${s.shopName} prépare ${what}. Livraison prévue sous ${delay}${commune ? ` à ${commune}` : ''}.`);
    } else {
      parts.push(`${s.shopName} prépare ${what}. Retrait en boutique à ${s.delivery.detail} : la boutique vous appelle au ${formatCiPhone(o.customer.phone)} quand c’est prêt.`);
    }
  }
  for (const l of rentals) {
    const r = l.rental!;
    parts.push(
      `${s.shopName} vous attend le ${formatDayShort(r.startDate)} à ${s.delivery.detail} pour «\u00A0${l.name}\u00A0» (${formatDays(r.days)}).`,
    );
  }
  return parts.join(' ');
}

