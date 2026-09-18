import { waLink } from "./utils";

/**
 * All WhatsApp integration in Vaishnavi's Stage uses free wa.me deep links.
 * We only ever *open* a prefilled chat — the user always taps Send
 * themselves. There is no paid WhatsApp Business API involved anywhere.
 */

export function whatsappEnquiryLink(phone: string, whoAreYou = "a visitor"): string {
  return waLink(
    phone,
    `Hi Vaishnavi! I'm ${whoAreYou} and I'd love to know more about booking you for an event. Could you share your availability?`
  );
}

export function whatsappShareAvailabilityLink(phone: string, availabilityUrl: string): string {
  return waLink(
    phone,
    `Hi! Here's Vaishnavi's live availability and booking page — you can check open dates and send a request directly: ${availabilityUrl}`
  );
}

export function whatsappTemplateShareLink(phone: string, filledMessage: string): string {
  return waLink(phone, filledMessage);
}
